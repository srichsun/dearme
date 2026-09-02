"""Tests for the notes this person keeps about how they eat."""
from sqlalchemy import select

from app.core import db
from app.models import MealNote


def test_a_note_round_trips_through_the_table(sqlite_db):
    with db.get_session() as s:
        s.add(MealNote(user_id="u1", text="吃油的飽足感很久"))
        s.commit()

    with db.get_session() as s:
        note = s.scalar(select(MealNote).where(MealNote.user_id == "u1"))

    assert note.text == "吃油的飽足感很久"
    assert note.created_at is not None
