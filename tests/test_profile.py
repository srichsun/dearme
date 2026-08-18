"""Rolling-read tests.

The writing itself is an LLM call, so the model is faked — what's checked here
is the wiring: that one person's own days are the raw material, that the
previous reading is carried forward, that the energy ratings go in alongside
the writing, that the streamed text is split back into sections, and that
nothing rebuilds it unless asked.
"""
from datetime import date

import pytest

from app.core import budget
from app.services import profile

U = "u-profile"

READING = {
    "who_you_are": "- runs regularly",
    "what_helps": "- a run before the day starts",
    "what_costs": "- goes quiet when overloaded",
    "suggestions": "- stop an hour earlier on the heavy days",
}


def _written(sections=READING):
    """A reading as the model writes it: headings, then prose."""
    return "\n\n".join(f"### {name}\n{sections[name]}" for name in sections)


class _Chunk:
    def __init__(self, content):
        self.content = content


def _fake_model(monkeypatch, text, seen=None):
    """Stand in for the condenser, streaming `text` back a piece at a time."""

    class _Model:
        def stream(self, prompt):
            if seen is not None:
                seen["prompt"] = prompt
            # In pieces, because the real one arrives that way and the split has
            # to survive a heading landing across two chunks.
            for i in range(0, len(text), 7):
                yield _Chunk(text[i : i + 7])

    monkeypatch.setattr(profile, "_condenser", _Model())


def test_no_reading_until_one_is_built(sqlite_db):
    assert profile.get_profile(U) == {}
    assert profile.as_prompt_text(U) == ""


def test_refresh_writes_and_saves(write_days, monkeypatch):
    write_days(U, "I started running again", "Nervous about the interview")
    seen = {}
    _fake_model(monkeypatch, _written(), seen)

    assert profile.refresh_profile(U) == READING
    assert profile.get_profile(U) == READING
    # Both days were handed to the model as raw material.
    assert "running" in seen["prompt"] and "interview" in seen["prompt"]


def test_the_energy_rating_goes_in_with_the_writing(write_days, monkeypatch):
    """The energy sections are read off what they actually rated, not guessed
    from the tone of the writing."""
    write_days(U, "a flat day", energy=3)
    seen = {}
    _fake_model(monkeypatch, _written(), seen)

    profile.refresh_profile(U)

    assert "energy 3/10" in seen["prompt"]


def test_a_reading_is_built_only_from_that_persons_days(write_days, monkeypatch):
    write_days(U, "only mine")
    write_days("other", "only theirs")
    seen = {}
    _fake_model(monkeypatch, _written(), seen)

    profile.refresh_profile(U)

    assert "only mine" in seen["prompt"]
    assert "only theirs" not in seen["prompt"]
    assert profile.get_profile("other") == {}


def test_refresh_carries_forward_the_previous_reading(write_days, monkeypatch):
    write_days(U, "first")
    _fake_model(monkeypatch, "### what_helps\nv1")
    profile.refresh_profile(U)

    seen = {}
    _fake_model(monkeypatch, "### what_helps\nv2", seen)
    profile.refresh_profile(U)

    assert "v1" in seen["prompt"]
    assert profile.get_profile(U)["what_helps"] == "v2"


def test_a_section_the_model_skipped_keeps_what_it_had(write_days, monkeypatch):
    """A missing heading is a formatting slip, not a statement that the person
    changed — and the reading is the only copy of it."""
    write_days(U, "first")
    _fake_model(monkeypatch, _written())
    profile.refresh_profile(U)

    _fake_model(monkeypatch, "### what_costs\nnow it is the late nights")
    profile.refresh_profile(U)

    assert profile.get_profile(U)["what_costs"] == "now it is the late nights"
    assert profile.get_profile(U)["who_you_are"] == READING["who_you_are"]


def test_writing_with_no_headings_leaves_the_old_reading_alone(write_days, monkeypatch):
    """Better a stale reading than an empty one."""
    write_days(U, "first")
    _fake_model(monkeypatch, _written())
    profile.refresh_profile(U)

    _fake_model(monkeypatch, "Sorry, I could not do that.")

    assert profile.refresh_profile(U) == READING
    assert profile.get_profile(U) == READING


def test_the_reading_streams_before_it_is_saved(write_days, monkeypatch):
    """The point of streaming: the words are on their way to the screen while
    the reading is still being written."""
    write_days(U, "first")
    _fake_model(monkeypatch, _written())

    pieces = list(profile.stream_and_save(U))

    assert len(pieces) > 1
    assert "".join(pieces) == _written()
    assert profile.get_profile(U) == READING


def test_a_heading_is_matched_however_the_model_dresses_it():
    text = "### who_you_are\nfirst\n\nwhat_helps:\nsecond\n\n## what_costs\nthird"

    assert profile.parse_sections(text) == {
        "who_you_are": "first",
        "what_helps": "second",
        "what_costs": "third",
    }


def test_anything_before_the_first_heading_is_dropped():
    """Where a model puts the "here is your reading" line nobody asked for."""
    text = "Here is your updated reading!\n\n### who_you_are\nthe real thing"

    assert profile.parse_sections(text) == {"who_you_are": "the real thing"}


def test_entries_behind_counts_days_written_since_the_last_rebuild(
    write_days, monkeypatch
):
    write_days(U, "one", "two")
    assert profile.entries_behind(U) == 2

    _fake_model(monkeypatch, _written())
    profile.refresh_profile(U)
    assert profile.entries_behind(U) == 0

    write_days(U, "three", ending_days_ago=5)
    assert profile.entries_behind(U) == 1


def test_the_prompt_text_keeps_the_sections_in_order(sqlite_db, monkeypatch):
    _fake_model(monkeypatch, _written())
    profile.refresh_profile(U)

    text = profile.as_prompt_text(U)

    assert (
        text.index("who_you_are")
        < text.index("what_helps")
        < text.index("what_costs")
        < text.index("suggestions")
    )
    assert "stop an hour earlier on the heavy days" in text


def test_every_section_is_named_in_the_prompt():
    """SECTIONS drives the screen's order and the split; the prompt is what the
    model is actually told to write. A section in one and not the other never
    reaches the page."""
    for name in profile.SECTIONS:
        assert f"**{name}**" in profile._CONDENSE_PROMPT


def test_the_reading_reaches_back_further_than_a_fortnight(write_days, monkeypatch):
    """A pattern that shows up every other week is invisible in two weeks of
    entries, so the window is wide enough to catch one."""
    write_days(U, "old enough to matter", ending_days_ago=40)
    seen = {}
    _fake_model(monkeypatch, _written(), seen)

    profile.refresh_profile(U)

    assert profile.READING_DAYS >= 60
    assert "old enough to matter" in seen["prompt"]


def test_a_rebuild_is_metered_like_a_day_is(write_days, monkeypatch):
    """Rebuilding spends a model call, so it is capped the same way analysing a
    day is — one rule to learn rather than two."""
    write_days(U, "first")
    _fake_model(monkeypatch, _written())

    assert profile.readings_left(U) == budget.READINGS_PER_DAY
    for _ in range(budget.READINGS_PER_DAY):
        profile.refresh_profile(U)
    assert profile.readings_left(U) == 0

    with pytest.raises(profile.NoReadingsLeft):
        profile.refresh_profile(U)


def test_the_allowance_refills_on_a_new_day(write_days, monkeypatch):
    """Nothing runs at midnight; a count stamped with an older date simply
    isn't today's."""
    from datetime import timedelta

    write_days(U, "first")
    _fake_model(monkeypatch, _written())
    profile.refresh_profile(U)

    monkeypatch.setattr(profile.clock, "today", lambda: date.today() + timedelta(days=1))

    assert profile.readings_left(U) == budget.READINGS_PER_DAY
