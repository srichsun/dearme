"""Request shapes for the shopping list."""
from pydantic import BaseModel


class ItemWrite(BaseModel):
    section: str
    text: str


class ItemPatch(BaseModel):
    text: str | None = None
    done: bool | None = None
