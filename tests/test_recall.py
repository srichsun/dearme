"""Semantic-recall tests.

PGVector needs a real Postgres with the vector extension, which we can't run
here, so we mock the store. These tests check the glue: that we call the store
the way we mean to, and format its results for the coach.
"""
import time

from app.models import CATEGORIES
from app.services import recall


class _Runtime:
    """Stands in for the ToolRuntime LangChain injects when the agent calls a
    tool; only the context — the caller's uid — is ever read."""

    def __init__(self, user_id):
        self.context = user_id


class _FakeStore:
    """Stands in for the PGVector store, recording calls and returning canned
    documents from similarity_search."""

    def __init__(self, docs=None):
        self.added = []
        self._docs = docs or []

    def add_texts(self, texts, metadatas=None, ids=None):
        self.added.append((texts, metadatas, ids))

    def similarity_search(self, query, k, filter=None):
        self.last = (query, k, filter)
        return self._docs[:k]


class _Doc:
    """A returned document. Without a fact_id in its metadata there is no row
    to look the journal day up from, which is also what happens for a vector
    left over from before facts carried one."""

    def __init__(self, content, fact_id=None):
        self.page_content = content
        self.metadata = {"fact_id": fact_id} if fact_id else {}


def test_index_fact_adds_text_keyed_by_row_id(monkeypatch):
    store = _FakeStore()
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    recall.index_fact(
        42, "still went for a run while exhausted", user_id="u9",
        category="health & habits",
    )

    assert store.added == [
        (
            ["still went for a run while exhausted"],
            [{"fact_id": 42, "user_id": "u9", "category": "health & habits"}],
            ["42"],
        )
    ]


def test_recall_filters_by_user(monkeypatch):
    store = _FakeStore(docs=[_Doc("first"), _Doc("second")])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    hits = recall.recall("interview nerves", user_id="u9", k=2)

    assert hits == ["first", "second"]
    # With no categories, the query is scoped to the user only.
    assert store.last == ("interview nerves", 2, {"user_id": "u9"})


def test_recall_narrows_to_categories(monkeypatch):
    store = _FakeStore(docs=[_Doc("ran anyway")])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    hits = recall.recall(
        "how do I cope", user_id="u9",
        categories=["health & habits", "patterns"], k=5,
    )

    assert hits == ["ran anyway"]
    # Category filter rides alongside the user filter (implicit AND).
    assert store.last == (
        "how do I cope",
        5,
        {"user_id": "u9", "category": {"$in": ["health & habits", "patterns"]}},
    )


def test_k_grows_with_the_number_of_categories(monkeypatch):
    """Two topics in one question shouldn't halve the depth of each — the
    budget is per category, not per search."""
    store = _FakeStore(docs=[_Doc("x")])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    recall.recall("goals and training", user_id="u9",
                  categories=["goals & aspirations", "health & habits"])

    assert store.last[1] == recall.TOP_K * 2


def test_k_is_capped_so_the_prompt_stays_bounded(monkeypatch):
    """Asking for every category must not drag the whole journal into the
    prompt — bounded prompt size is the point of the three layers."""
    store = _FakeStore(docs=[_Doc("x")])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    recall.recall("everything", user_id="u9", categories=list(CATEGORIES))

    assert store.last[1] == recall.MAX_K


def test_an_unfiltered_search_uses_the_plain_budget(monkeypatch):
    store = _FakeStore(docs=[_Doc("x")])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    recall.recall("anything", user_id="u9")

    assert store.last[1] == recall.TOP_K


def test_search_past_entries_tool_uses_the_runs_context(monkeypatch):
    """The tool scopes to whoever LangChain says is running, never a global."""
    seen = {}
    monkeypatch.setattr(
        recall,
        "recall",
        lambda q, user_id=None, categories=None, k=recall.TOP_K: seen.update(
            uid=user_id, categories=categories
        )
        or ["a win", "a worry"],
    )
    out = recall.search_past_entries.func("how am I doing", _Runtime("u-caller"))

    assert out == ["a win", "a worry"]
    assert seen["uid"] == "u-caller"


def test_search_past_entries_passes_categories_through(monkeypatch):
    """The model can narrow the search; the tool forwards its choice."""
    seen = {}
    monkeypatch.setattr(
        recall,
        "recall",
        lambda q, user_id=None, categories=None, k=recall.TOP_K: seen.update(
            categories=categories
        )
        or ["x"],
    )
    recall.search_past_entries.func(
        "coping", _Runtime("u-caller"), categories=["patterns"]
    )

    assert seen["categories"] == ["patterns"]


def test_the_model_sees_query_and_categories_but_not_runtime():
    """`runtime` is injected by LangChain, so it must stay out of the schema the
    model is shown; query and categories are the model's to fill."""
    assert list(recall.search_past_entries.args) == ["query", "categories"]


def test_search_past_entries_tool_handles_no_history(monkeypatch):
    monkeypatch.setattr(
        recall,
        "recall",
        lambda q, user_id=None, categories=None, k=recall.TOP_K: [],
    )

    out = recall.search_past_entries.func("anything", _Runtime("u-caller"))

    assert out == "No related past facts found."


def test_a_fact_comes_back_stamped_with_the_day_it_was_written(sqlite_db, monkeypatch):
    """The date is what lets an answer say "you wrote this on the 19th" instead
    of asserting it out of nowhere."""
    from datetime import date

    from app.core import db
    from app.models import Entry, Fact

    with db.get_session() as s:
        entry = Entry(user_id="u9", entry_date=date(2026, 7, 19), content="a day")
        s.add(entry)
        s.commit()
        fact = Fact(user_id="u9", entry_id=entry.id, category="wins", text="ran 5k")
        s.add(fact)
        s.commit()
        fact_id = fact.id

    store = _FakeStore(docs=[_Doc("ran 5k", fact_id=fact_id)])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    assert recall.recall("running", user_id="u9") == ["2026-07-19 — ran 5k"]


def test_a_fact_with_no_row_behind_it_still_comes_back(sqlite_db, monkeypatch):
    """A vector whose SQL row is gone is stale, not fatal — the coach can still
    use the text, it just can't cite a day for it."""
    store = _FakeStore(docs=[_Doc("orphaned", fact_id=9999)])
    monkeypatch.setattr(recall, "_facts_store", lambda: store)

    assert recall.recall("anything", user_id="u9") == ["orphaned"]


def test_the_store_is_built_once_even_when_threads_arrive_together(monkeypatch):
    """A turn can fire several tool calls, and the agent runs them in parallel —
    so two threads asking for the store at the same moment is the normal case.

    PGVector declares its SQLAlchemy tables on first construction and only sets
    its "already built" flag afterwards, so a second thread that starts building
    while the first is mid-flight dies on a duplicate table. Building must happen
    once and alone.
    """
    import threading

    builds = []
    start = threading.Barrier(4)

    def slow_build(**kwargs):
        builds.append(kwargs)
        # Wide enough for every other thread to reach the check if it isn't held.
        time.sleep(0.05)
        return object()

    monkeypatch.setattr(recall, "_store", None)
    monkeypatch.setattr(recall, "PGVector", slow_build)
    monkeypatch.setattr(recall, "OpenAIEmbeddings", lambda **kw: object())

    seen = []

    def ask():
        start.wait()
        seen.append(recall._facts_store())

    threads = [threading.Thread(target=ask) for _ in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(builds) == 1
    assert len(set(map(id, seen))) == 1
