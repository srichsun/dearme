"""The notes this person keeps about how they eat.

Add, list, delete — no edit, and no LLM. A note is kept exactly as said,
because it is raw material for a later "condense into patterns" step, and a
pattern drawn from paraphrased notes is a pattern about the paraphrase.
Said wrong? Delete it and say it again.

Every query filters on user_id as well as id, like the meals.
"""
from sqlalchemy import select

from app.core import db
from app.models import MealNote


def list_notes(user_id: str) -> list[MealNote]:
    """One person's notes, newest first."""
    if not user_id:
        return []
    with db.get_session() as s:
        stmt = (
            select(MealNote)
            .where(MealNote.user_id == user_id)
            .order_by(MealNote.created_at.desc(), MealNote.id.desc())
        )
        return list(s.scalars(stmt))


def add_note(user_id: str, text: str) -> MealNote | None:
    """Keep a note. Blank input is ignored rather than stored."""
    text = (text or "").strip()
    if not text:
        return None
    with db.get_session() as s:
        note = MealNote(user_id=user_id, text=text)
        s.add(note)
        s.commit()
        return note


def delete_note(user_id: str, note_id: int) -> bool:
    """Remove one of this person's notes. False if it isn't theirs."""
    with db.get_session() as s:
        note = s.scalar(
            select(MealNote).where(MealNote.id == note_id, MealNote.user_id == user_id)
        )
        if note is None:
            return False
        s.delete(note)
        s.commit()
        return True
