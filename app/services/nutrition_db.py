"""Taiwan FDA food composition table (衛福部食品營養成分資料庫), per 100 g.

app/data/tfnd.json is the 2,180-food table squeezed out of the FDA's open
data (data.gov.tw dataset 8543; long format, ~227k rows). The model breaks a
meal into items and guesses grams; this module is the check: if an item
matches a food here, the official numbers × grams replace the guess.

Matching is deliberately simple — exact name or alias first, then the
longest name/alias contained in the query, then the query contained in a
name. No embeddings: the vocabulary is small and Chinese food names are
short; a wrong fuzzy match is worse than falling back to the model.
"""
import json
from functools import lru_cache
from pathlib import Path

_PATH = Path(__file__).resolve().parents[1] / "data" / "tfnd.json"

NUTRIENTS = ("kcal", "protein", "fat", "carbs")


@lru_cache(maxsize=1)
def foods() -> list[dict]:
    with open(_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _index() -> dict[str, dict]:
    """Every name and alias → its food. Later entries never overwrite an
    exact earlier one, so the canonical name wins over a shared alias."""
    idx: dict[str, dict] = {}
    for food in foods():  # canonical names first: 馬鈴薯 is the potato,
        idx.setdefault(_norm(food["name"]), food)  # not 紅馬鈴薯's alias
    for food in foods():
        for alias in food["aliases"]:
            # 洋芋 is an alias of 紅馬鈴薯, 馬鈴薯 and 小馬鈴薯 alike: an alias
            # points at the plainest variant, i.e. the shortest name.
            key = _norm(alias)
            if key not in idx or len(food["name"]) < len(idx[key]["name"]):
                idx[key] = food
    return idx


def _norm(s: str) -> str:
    return (s or "").strip().replace("（", "(").replace("）", ")").lower()


def match(name: str) -> dict | None:
    """The food this item name means, or None when nothing fits well.

    "馬鈴薯" → 馬鈴薯. "水煮馬鈴薯" → 馬鈴薯 (longest contained name).
    "薯條" → None unless the table has it: partial matches must be at least
    two characters and must be a whole entry, never a substring of one.
    """
    q = _norm(name)
    if not q:
        return None
    idx = _index()
    if q in idx:
        return idx[q]
    # A table entry contained in the query: prefer the longest.
    best = None
    for key, food in idx.items():
        if len(key) >= 2 and key in q and (best is None or len(key) > len(best[0])):
            best = (key, food)
    if best:
        return best[1]
    # The query contained in an entry, only for a specific enough query.
    if len(q) >= 3:
        for key, food in idx.items():
            if q in key:
                return food
    return None


def per_grams(food: dict, grams: float) -> dict:
    """kcal / protein / fat / carbs for this many grams of the food."""
    factor = max(grams, 0) / 100.0
    return {n: round((food.get(n) or 0) * factor, 1) for n in NUTRIENTS}
