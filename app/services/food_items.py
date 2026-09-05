"""The person's own food numbers: labels read, chain tables quoted.

Kept per 100 g so "half a bag" scales. Looked up by name before any
estimate: a name that equals or contains a saved name — or is contained
in one — uses the saved numbers (source "saved").
"""
from sqlalchemy import select

from app.core import db
from app.models import FoodItem

NUTRIENTS = ("kcal", "protein", "carbs", "fat")


def _norm(s: str) -> str:
    return (s or "").strip().replace("（", "(").replace("）", ")").lower()


def _dict(i: FoodItem) -> dict:
    return {
        "id": i.id, "name": i.name, "serving_g": i.serving_g, "source": i.source,
        **{n: getattr(i, f"{n}_100") for n in NUTRIENTS},  # per 100 g
    }


def list_items(user_id: str) -> list[dict]:
    if not user_id:
        return []
    with db.get_session() as s:
        return [_dict(i) for i in s.scalars(select(FoodItem).where(FoodItem.user_id == user_id).order_by(FoodItem.name))]


def remember(user_id: str, name: str, grams: float, values: dict, source: str) -> dict | None:
    """Keep a food's numbers, per 100 g. Replaces an earlier row of the same
    name — the latest label read is the truth. Nothing kept for 0 g."""
    name = (name or "").strip()
    if not name or not grams or grams <= 0:
        return None
    per100 = {f"{n}_100": round(float(values.get(n) or 0) * 100.0 / grams, 2) for n in NUTRIENTS}
    with db.get_session() as s:
        row = s.scalar(select(FoodItem).where(FoodItem.user_id == user_id, FoodItem.name == name))
        if row is None:
            row = FoodItem(user_id=user_id, name=name, serving_g=grams, source=source, **per100)
            s.add(row)
        else:
            row.serving_g, row.source = grams, source
            for k, v in per100.items():
                setattr(row, k, v)
        s.commit()
        return _dict(row)


def forget(user_id: str, item_id: int) -> bool:
    with db.get_session() as s:
        row = s.scalar(select(FoodItem).where(FoodItem.id == item_id, FoodItem.user_id == user_id))
        if row is None:
            return False
        s.delete(row)
        s.commit()
        return True


def match(user_id: str, name: str) -> dict | None:
    """The saved food this name means: equal first, then the longest saved
    name contained in it, then a saved name that contains it (3+ chars)."""
    q = _norm(name)
    if not q or not user_id:
        return None
    rows = list_items(user_id)
    for r in rows:
        if _norm(r["name"]) == q:
            return r
    best = None
    for r in rows:
        k = _norm(r["name"])
        if len(k) >= 2 and k in q and (best is None or len(k) > len(_norm(best["name"]))):
            best = r
    if best:
        return best
    if len(q) >= 3:
        for r in rows:
            if q in _norm(r["name"]):
                return r
    return None


def per_grams(item: dict, grams: float) -> dict:
    f = max(grams, 0) / 100.0
    return {n: round(item[n] * f, 1) for n in NUTRIENTS}
