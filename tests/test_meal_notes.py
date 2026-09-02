"""Tests for the notes this person keeps about how they eat.

Stored as said, listed newest first, and never reachable from another account.
"""
from sqlalchemy import select

from app.core import db
from app.models import MealNote
from app.services import meal_notes


def test_a_note_round_trips_through_the_table(sqlite_db):
    with db.get_session() as s:
        s.add(MealNote(user_id="u1", text="吃油的飽足感很久"))
        s.commit()

    with db.get_session() as s:
        note = s.scalar(select(MealNote).where(MealNote.user_id == "u1"))

    assert note.text == "吃油的飽足感很久"
    assert note.created_at is not None


def test_notes_come_back_newest_first(sqlite_db):
    meal_notes.add_note("u1", "看到 7-11 健康便當根本不想吃")
    meal_notes.add_note("u1", "早上不想吃燕麥，因為不香不油")

    texts = [n.text for n in meal_notes.list_notes("u1")]

    assert texts == ["早上不想吃燕麥，因為不香不油", "看到 7-11 健康便當根本不想吃"]


def test_text_is_kept_as_said_apart_from_stray_space(sqlite_db):
    kept = meal_notes.add_note("u1", "  吃油的飽足感很久  ")
    assert kept.text == "吃油的飽足感很久"


def test_blank_notes_are_not_kept(sqlite_db):
    for blank in ("", "   ", "\n", None):
        assert meal_notes.add_note("u1", blank) is None
    assert meal_notes.list_notes("u1") == []


def test_deleting_removes_it(sqlite_db):
    kept = meal_notes.add_note("u1", "吃油的飽足感很久")

    assert meal_notes.delete_note("u1", kept.id) is True
    assert meal_notes.list_notes("u1") == []


# --- one account must never reach another's notes ---

def test_listing_is_scoped_to_one_person(sqlite_db):
    meal_notes.add_note("u1", "mine")
    meal_notes.add_note("u2", "theirs")

    assert [n.text for n in meal_notes.list_notes("u1")] == ["mine"]
    assert meal_notes.list_notes("") == []


def test_someone_elses_note_cannot_be_deleted(sqlite_db):
    theirs = meal_notes.add_note("u2", "theirs")

    assert meal_notes.delete_note("u1", theirs.id) is False
    assert len(meal_notes.list_notes("u2")) == 1
