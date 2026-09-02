"""Request shapes for the meals list and the eating notes.

Deliberately loose: the codes are checked by the service, which is where the
rules live, so the same message comes back whether the caller is HTTP or a
future planner.
"""
from pydantic import BaseModel


class MealWrite(BaseModel):
    """A whole meal, as the dialog sends it — for both create and update."""

    name: str
    category: str
    source: str
    season: str
    method: str | None = None
    recipe: str | None = None
    note: str | None = None


class NoteWrite(BaseModel):
    text: str
