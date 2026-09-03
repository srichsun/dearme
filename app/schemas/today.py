"""Request shapes for the today screen."""
from pydantic import BaseModel


class GoalWrite(BaseModel):
    text: str


class HabitWrite(BaseModel):
    text: str


class FocusWrite(BaseModel):
    text: str
