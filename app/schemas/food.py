"""Request shapes for the food log."""
from pydantic import BaseModel, StrictInt


class LogWrite(BaseModel):
    text: str
    kcal: float
    protein: float
    carbs: float
    fat: float
    kind: str = "meal"
    source: str = "model"
    items: list[dict] = []
    photo_url: str | None = None
    meal_id: int | None = None


class LogPatch(BaseModel):
    text: str | None = None
    kcal: float | None = None
    protein: float | None = None
    carbs: float | None = None
    fat: float | None = None


class TargetsWrite(BaseModel):
    kcal: StrictInt
    protein: StrictInt
    carbs: StrictInt
    fat: StrictInt
