"""The rolling read of one person — the long-term memory layer.

The other two layers look at moments: plain SQL (entries) answers "what
happened on the 18th", semantic recall (pgvector) finds "something like this
before". This one is the sum: who this person is, what they keep doing, and
what actually lifts their energy.

Rebuilt only when the person presses the button. Nothing in the app refreshes
it in the background — the same rule as the day's analysis, and for the same
reason: they should know when the machine has just spent a model call on them,
and be able to read a page without wondering whether it changed underneath.
"""
import re
from collections.abc import Iterator

from app.core import budget, clock, db
from app.models import Profile
from app.services import chat_model, entries

# The four parts of the reading, in the order the screen shows them: who you
# are, then the two halves of your energy, then what to do about them.
# Suggestions come last because a suggestion that arrives before the pattern it
# addresses reads as advice from a stranger.
#
# Lift and drain are two sections rather than one "patterns" block on purpose:
# folded together, the costly half swallows the other, and the person leaves
# with a list of what is wrong with them. Protecting energy is half the work,
# so it gets half the page.
SECTIONS = ("who_you_are", "what_helps", "what_costs", "suggestions")

# How far back a rebuild reads, and how long the result may be — see
# app.core.budget, where every number that costs money lives together.
READING_DAYS = budget.READING_DAYS


_CONDENSE_PROMPT = (
    "You keep a rolling read of one person, built from the journal they write "
    "each day. Rewrite it from the entries below, keeping what is still true "
    "and dropping one-off trivia. Keep something because the entries still "
    "support it, not because it is recent — a thing they haven't mentioned "
    "lately is not thereby untrue, and the steadiest parts of a person are the "
    "ones least often written down. Drop it when something they wrote actually "
    "overturns it.\n\n"
    "Four parts, each a few short paragraphs or bullets:\n\n"
    "**who_you_are** — who this person is: their situation, what they care "
    "about, the people who matter, what they're reaching for. Ground it in "
    "what they have actually done, and say those things plainly — they lose "
    "sight of their own record, and this is where they come to find it. Lean "
    "warm here: name the things they have pulled off, especially the ones they "
    "did while afraid or exhausted. Warm means specific, not flattering — a "
    "real day named does more than any amount of praise. Never guess at facts "
    "they haven't stated.\n\n"
    "**what_helps** — what reliably raises their energy or protects the energy "
    "they already have. Read their energy ratings against what they wrote on "
    "those days, and name what preceded the good ones. Count the quiet kinds "
    "too: stopping earlier, saying no, leaving something undone. Be specific — "
    "a pattern named vaguely is no use.\n\n"
    "**what_costs** — what reliably drains them, especially what they keep "
    "doing under stress. Name what preceded the flat days. Be honest and "
    "unflinching, but describe the behaviour, not the person — this is a "
    "pattern they can act on, not a verdict on their character. If the ratings "
    "are too few to say anything, say that rather than inventing a trend.\n\n"
    "**suggestions** — one or two concrete things worth trying next, each "
    "small enough to start today, and each tied to something named in the two "
    "sections above rather than to general advice: more of what helps, or less "
    "of what costs. Only what the entries actually support.\n\n"
    "Keep the whole thing under ~{words} words: it is injected into every "
    "conversation, so it must not grow without bound.\n\n"
    "Write the four parts in the order above, each opening with its name on a "
    "line of its own as a heading — `### who_you_are` — and nothing else on "
    "that line. Write no preamble before the first heading and no closing "
    "remark after the last part. The headings are how the page finds each "
    "part; a part written without one never reaches the screen.\n\n"
    "Current read:\n{existing}\n\n"
    "Journal entries (newest first):\n{recent}\n\n"
)

# Plain text, not structured output: the reading is streamed so the person
# watches it arrive instead of waiting a minute on a blank page, and a schema
# only resolves once the whole object is complete. The headings below buy the
# same thing at the cost of trusting the model to write them.
_condenser = chat_model.build_chat_model(timeout=chat_model.WRITE_TIMEOUT)

# A heading line, and nothing else on it: "### what_helps".
_HEADING = re.compile(r"^[#\s]*(" + "|".join(SECTIONS) + r")\s*:?\s*$", re.MULTILINE)


def get_profile(user_id: str) -> dict:
    """One person's current reading as {section: text}, or {} if none yet."""
    if not user_id:
        return {}
    with db.get_session() as s:
        row = s.get(Profile, user_id)
        return dict(row.sections or {}) if row else {}


def as_prompt_text(user_id: str) -> str:
    """The reading flattened into prose, for injecting into the coach's prompt."""
    sections = get_profile(user_id)
    parts = [f"{name}:\n{sections[name]}" for name in SECTIONS if sections.get(name)]
    return "\n\n".join(parts)


class NoReadingsLeft(Exception):
    """Raised when today's allowance of rebuilds is used up."""


def readings_left(user_id: str) -> int:
    """How many rebuilds this person has left today.

    The allowance refills at midnight on its own: a count stamped with an older
    date is simply not today's, so nothing has to run to reset it.
    """
    with db.get_session() as s:
        row = s.get(Profile, user_id)
        used = row.rebuild_count if row and row.rebuilt_on == clock.today() else 0
    return max(0, budget.READINGS_PER_DAY - used)


def _spend_reading(user_id: str) -> None:
    """Charge one of today's rebuilds, or refuse once they're gone."""
    today = clock.today()
    with db.get_session() as s:
        row = s.get(Profile, user_id)
        if row is None:
            row = Profile(key=user_id)
            s.add(row)
        if row.rebuilt_on != today:
            row.rebuilt_on, row.rebuild_count = today, 0
        if row.rebuild_count >= budget.READINGS_PER_DAY:
            raise NoReadingsLeft
        row.rebuild_count += 1
        s.commit()


def entries_behind(user_id: str) -> int:
    """How many journal days have been written since the last rebuild.

    The screen shows this so the button isn't a mystery: pressing it is worth
    something when this is more than zero, and nothing when it isn't.
    """
    with db.get_session() as s:
        row = s.get(Profile, user_id)
        last = row.entry_count if row else 0
    return max(0, entries.count_entries(user_id) - last)


def parse_sections(text: str) -> dict:
    """Split a written reading into {section: text} on its headings.

    Anything before the first heading is dropped — that is where a model puts
    the "here is your reading" line nobody asked for. A section the model left
    out simply isn't in the result; the caller decides what that means.
    """
    parts: dict = {}
    matches = list(_HEADING.finditer(text))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[m.end():end].strip()
        if body:
            parts[m.group(1)] = body
    return parts


def _prompt_for(user_id: str) -> str:
    """The condense prompt for one person: their current reading, then their
    recent days with the energy they gave each one — so the energy sections are
    read off what they actually rated rather than guessed from the tone."""
    existing = get_profile(user_id)
    existing_text = "\n\n".join(
        f"{name}:\n{existing[name]}" for name in SECTIONS if existing.get(name)
    )
    recent_text = "\n\n".join(
        f"[{e.entry_date} · energy {e.energy if e.energy else '—'}/10]\n{e.content}"
        for e in entries.recent_entries(user_id, limit=READING_DAYS)
    )
    return _CONDENSE_PROMPT.format(
        words=budget.READING_WORDS,
        existing=existing_text or "(empty)",
        recent=recent_text or "(none)",
    )


def _save(user_id: str, written: str) -> dict:
    """Store a finished reading, and return what was stored.

    A section the model didn't write keeps whatever it had: the reading is the
    only copy, and a heading the model forgot is a formatting slip, not a
    statement that the person changed. Nothing is stored at all if the writing
    yielded no sections — better a stale reading than an empty one.
    """
    parts = parse_sections(written)
    if not parts:
        return get_profile(user_id)
    updated = {**get_profile(user_id), **parts}
    with db.get_session() as s:
        row = s.get(Profile, user_id)
        if row is None:
            row = Profile(key=user_id)
            s.add(row)
        row.sections = updated
        row.entry_count = entries.count_entries(user_id)
        s.commit()
    return updated


def stream_and_save(user_id: str) -> Iterator[str]:
    """Write the reading, streaming it as it comes, then store it.

    Streaming is the whole point of the plain-text format: this call runs to a
    thousand words, and a minute of blank page reads as broken however fast the
    answer eventually lands.
    """
    _spend_reading(user_id)
    written = []
    for chunk in _condenser.stream(_prompt_for(user_id)):
        text = chunk.content if isinstance(chunk.content, str) else ""
        if text:
            written.append(text)
            yield text
    _save(user_id, "".join(written))


def refresh_profile(user_id: str) -> dict:
    """Rebuild one person's reading and return it, without streaming."""
    for _ in stream_and_save(user_id):
        pass
    return get_profile(user_id)
