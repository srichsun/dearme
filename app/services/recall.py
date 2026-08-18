"""Semantic recall over the person's atomic facts, backed by pgvector.

Each fact pulled from an exchange (see app.services.facts) is embedded on its
own and stored in a pgvector collection alongside its category. During a
conversation the coach can call search_past_entries to pull back the facts most
related to what the person is talking about now — the "understands you right
now" layer (semantic memory), separate from the plain-SQL day queries.

Storing one vector per single-topic fact — rather than one per whole turn — is
the point: a search for "health" matches only the health fact, instead of being
diluted by the work and relationship threads that shared the same turn.

PGVector needs a real Postgres with the vector extension, so the store is built
lazily on first use and mocked in tests (SQLite can't run it).
"""
from threading import Lock

from langchain.tools import ToolRuntime
from langchain_core.tools import tool
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
from sqlalchemy import select

from app.core import budget, config
from app.models import Category

# Kept separate from the SQL `facts` table; PGVector manages its own tables.
# A distinct collection from any earlier per-entry store so fact ids and entry
# ids can never collide.
FACTS_COLLECTION = "facts"

TOP_K = budget.RECALL_PER_CATEGORY

MAX_K = budget.RECALL_MAX


_store: PGVector | None = None
# Building the store must happen once and alone. PGVector declares its SQLAlchemy
# tables on first construction and only sets its "already built" flag afterwards,
# so two threads arriving together both start declaring and the second one dies on
# "Table 'langchain_pg_collection' is already defined". A turn can fire several
# tool calls at once, and the agent runs them in parallel — so two threads
# arriving together is the normal case here, not a rare one.
_store_lock = Lock()


def _facts_store() -> PGVector:
    """The pgvector fact store, built once on first use.

    Needs a live Postgres (with the vector extension) and an OpenAI key for
    embeddings, so we don't build it at import time.
    """
    global _store
    if _store is not None:
        return _store
    with _store_lock:
        # Someone may have built it while we waited for the lock.
        if _store is None:
            embeddings = OpenAIEmbeddings(
                model=config.OPENAI_EMBEDDING_MODEL,
                api_key=config.OPENAI_API_KEY,
            )
            _store = PGVector(
                embeddings=embeddings,
                collection_name=FACTS_COLLECTION,
                connection=config.DATABASE_URL,
                use_jsonb=True,
            )
    return _store


def index_fact(fact_id: int, text: str, user_id: str, category: str) -> None:
    """Embed one fact into pgvector, keyed by its row id.

    Using the SQL row id as the vector id keeps the two stores in sync and makes
    re-indexing the same fact idempotent (it overwrites, not appends). The user
    id and category ride along as metadata so recall can filter to one person
    and, optionally, to just the categories the coach asked for.
    """
    _facts_store().add_texts(
        [text],
        metadatas=[
            {"fact_id": fact_id, "user_id": user_id, "category": category}
        ],
        ids=[str(fact_id)],
    )


def forget_facts(fact_ids: list[int]) -> None:
    """Drop these facts from the vector store.

    Re-analysing a day rewrites its facts, and a vector left behind would go on
    being recalled as if the person had said something they since rewrote —
    a memory of a draft. Deleting by the same ids we indexed under keeps the
    two stores from drifting apart.
    """
    if fact_ids:
        _facts_store().delete([str(i) for i in fact_ids])


def recall(
    query: str,
    user_id: str,
    categories: list[Category] | None = None,
    k: int | None = None,
) -> list[str]:
    """Return up to k of one person's facts most relevant to the query, each
    prefixed with the journal day it came from ("2026-07-19 — ...").

    The date is what lets an answer say "you wrote this on the 19th" instead of
    asserting it out of nowhere. It comes from the SQL row, not the vector
    metadata, so a fact re-extracted on a later day still reports the day it
    was actually written about.

    When categories is given, the search is restricted to those categories
    (the two metadata keys combine as an implicit AND), and k grows with how
    many were asked for — someone talking about their goals *and* their health
    needs both covered properly, not four facts each. Pass k to override.
    """
    if k is None:
        k = min(TOP_K * max(1, len(categories or [])), MAX_K)
    metadata_filter: dict = {"user_id": user_id}
    if categories:
        metadata_filter["category"] = {"$in": categories}
    docs = _facts_store().similarity_search(query, k=k, filter=metadata_filter)
    dates = _days_for([d.metadata.get("fact_id") for d in docs])
    return [
        f"{dates[d.metadata['fact_id']]} — {d.page_content}"
        if dates.get(d.metadata.get("fact_id"))
        else d.page_content
        for d in docs
    ]


def _days_for(fact_ids: list) -> dict:
    """The journal day each of these facts was written about, by fact id."""
    ids = [i for i in fact_ids if i is not None]
    if not ids:
        return {}
    from app.core import db
    from app.models import Entry, Fact

    with db.get_session() as s:
        rows = s.execute(
            select(Fact.id, Entry.entry_date)
            .join(Entry, Entry.id == Fact.entry_id)
            .where(Fact.id.in_(ids))
        )
        return {fact_id: day.isoformat() for fact_id, day in rows}


@tool
def search_past_entries(
    query: str,
    runtime: ToolRuntime[str],
    categories: list[Category] | None = None,
) -> str | list[str]:
    """Search what you know about this person for facts related to what they are
    talking about now. Use this to ground your reply in their real history —
    what they've told you before, recurring patterns, or similar feelings —
    instead of guessing. The query should describe the current topic or feeling.

    Optionally narrow the search to one or more categories (omit to search all):
    "about me", "preferences", "people", "work & career", "goals & aspirations",
    "health & habits", "beliefs", "patterns", "wins", "gratitude". Pick the
    categories that fit the topic — e.g. ["health & habits", "patterns"] when
    they're talking about how they cope with stress, or ["wins"] when they have
    forgotten what they are capable of and need their own record shown back to
    them."""
    # `runtime` is injected by LangChain, not chosen by the model — it never
    # appears in the tool schema the model sees. Its context is the caller's uid.
    hits = recall(query, user_id=runtime.context, categories=categories)
    if not hits:
        return "No related past facts found."
    return hits
