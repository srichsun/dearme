"""A meal, in words or a photo, to numbers — then checked against Taiwan's
food table.

The model's job is the part a person hates doing: break "炸雞胸加薯條" into
items and guess grams. The table's job is the part a model is bad at:
the numbers. Each item that matches a table food gets the official values
× grams (source "tfnd"); the rest keep the model's guess ("model"). A
nutrition-label photo is different: the model reads the printed numbers
and we trust them ("label").
"""
import base64
from functools import lru_cache

from langchain_core.messages import HumanMessage
from pydantic import BaseModel, Field

from app.services import chat_model, nutrition_db

NUTRIENTS = ("kcal", "protein", "carbs", "fat")


class _Item(BaseModel):
    name: str = Field(description="the item as the person would call it, in their language")
    grams: float = Field(description="estimated weight eaten, in grams")
    kcal: float
    protein: float = Field(description="grams of protein")
    carbs: float = Field(description="grams of carbohydrate")
    fat: float = Field(description="grams of fat")
    table_name: str | None = Field(
        default=None,
        description=(
            "the plain Traditional-Chinese generic food this item is made of, as a "
            "food-composition table would list it: 雞胸肉, 白飯, 馬鈴薯, 雞蛋, 鮭魚. "
            "Empty for dishes with no single main ingredient."
        ),
    )


class _Estimate(BaseModel):
    items: list[_Item] = Field(default_factory=list)
    note: str = Field(default="", description="one short line on what was assumed")


MEAL_PROMPT = """You estimate what a person ate. Break it into items with grams and nutrition for the amount eaten. Taiwanese portions unless told otherwise (一碗白飯 ≈ 200 g, 一份雞胸 ≈ 150 g, 一杯手搖飲 ≈ 500 ml). If there is a photo, judge portions from it and use the words as hints. Answer item names in the person's language. For table_name give the generic ingredient a food-composition table would list. Description: {text}"""

LABEL_PROMPT = """This is a nutrition facts label (營養標示). Read the numbers exactly: per-serving values and servings per package. The person ate {portion}. Return ONE item named after the product with kcal, protein, carbs, fat for what was eaten, grams = serving size × servings eaten if shown. table_name empty. Words from the person: {text}"""


@lru_cache(maxsize=2)
def _estimator(vision: bool):
    """The better model for photos (it has to see), the cheap one for words."""
    return chat_model.build_chat_model(
        timeout=chat_model.WRITE_TIMEOUT, worker=not vision
    ).with_structured_output(_Estimate)


def ask_model(text: str, photo: bytes | None, content_type: str, kind: str) -> _Estimate:
    prompt = (
        LABEL_PROMPT.format(text=text or "(none)", portion=text or "the whole package")
        if kind == "label"
        else MEAL_PROMPT.format(text=text or "(see photo)")
    )
    content: list = [{"type": "text", "text": prompt}]
    if photo:
        b64 = base64.b64encode(photo).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:{content_type};base64,{b64}"}})
    return _estimator(vision=bool(photo)).invoke([HumanMessage(content=content)])


def check(estimate: _Estimate, kind: str) -> dict:
    """Swap in the table's numbers where an item matches; sum the rest."""
    items = []
    for it in estimate.items:
        row = {
            "name": it.name, "grams": round(it.grams, 0),
            "kcal": round(it.kcal, 0), "protein": round(it.protein, 1),
            "carbs": round(it.carbs, 1), "fat": round(it.fat, 1),
            "source": "label" if kind == "label" else "model", "matched": None,
        }
        if kind != "label":
            food = nutrition_db.match(it.table_name or "") or nutrition_db.match(it.name)
            if food and it.grams > 0:
                row.update(nutrition_db.per_grams(food, it.grams))
                row["kcal"] = round(row["kcal"], 0)
                row["source"], row["matched"] = "tfnd", food["name"]
        items.append(row)
    totals = {n: round(sum(i[n] for i in items), 1 if n != "kcal" else 0) for n in NUTRIENTS}
    sources = {i["source"] for i in items}
    source = sources.pop() if len(sources) == 1 else ("mixed" if sources else "model")
    return {"items": items, "totals": totals, "note": estimate.note, "source": source}


def estimate(text: str, photo: bytes | None = None, content_type: str = "image/jpeg", kind: str = "meal") -> dict:
    return check(ask_model(text, photo, content_type, kind), kind)
