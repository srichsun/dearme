"""The "what can I eat" list.

Plain CRUD. The rules live here, not in the routes, so a test can hit them
without HTTP and a future caller (the week planner) gets the same answers:

- a name is required;
- category / source / season / method must be one of the known codes;
- home-cooked needs a method — it is the axis this list gets searched on;
- eating out has no method and no recipe, whatever was sent. Keeping a stale
  method on an eat-out row would make it show up under "air fryer".

Every read, update and delete filters on user_id as well as id, so a guessed
id never reaches someone else's row.
"""
from sqlalchemy import select

from app.core import db
from app.models import MEAL_CATEGORIES, METHODS, SEASONS, SOURCES, Meal


class MealError(ValueError):
    """The input breaks one of the rules above; the message says which."""


def _text(value: str | None) -> str | None:
    """Trim free text; empty becomes None so the column stays clean."""
    value = (value or "").strip()
    return value or None


def _clean(
    *,
    name: str,
    category: str,
    source: str,
    season: str,
    method: str | None = None,
    recipe: str | None = None,
    note: str | None = None,
) -> dict:
    """Apply the rules and return the column values to store."""
    name = (name or "").strip()
    if not name:
        raise MealError("A meal needs a name")
    if category not in MEAL_CATEGORIES:
        raise MealError(f"Unknown category {category!r}")
    if source not in SOURCES:
        raise MealError(f"Unknown source {source!r}")
    if season not in SEASONS:
        raise MealError(f"Unknown season {season!r}")

    if source == "eat_out":
        method, recipe = None, None
    else:
        if method not in METHODS:
            raise MealError("A home-cooked meal needs a cooking method")
        recipe = _text(recipe)

    return {
        "name": name,
        "category": category,
        "source": source,
        "season": season,
        "method": method,
        "recipe": recipe,
        "note": _text(note),
    }


def list_meals(user_id: str) -> list[Meal]:
    """One person's meals, newest first."""
    if not user_id:
        return []
    with db.get_session() as s:
        stmt = (
            select(Meal)
            .where(Meal.user_id == user_id)
            .order_by(Meal.created_at.desc(), Meal.id.desc())
        )
        return list(s.scalars(stmt))


def get_meal(user_id: str, meal_id: int) -> Meal | None:
    with db.get_session() as s:
        return s.scalar(
            select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
        )


def create_meal(user_id: str, **fields) -> Meal:
    """Add a meal. Raises MealError on bad input."""
    values = _clean(**fields)
    with db.get_session() as s:
        meal = Meal(user_id=user_id, **values)
        s.add(meal)
        s.commit()
        return meal


def update_meal(user_id: str, meal_id: int, **fields) -> Meal | None:
    """Replace every field of one of this person's meals. None if it isn't
    theirs; MealError on bad input (checked before anything is touched)."""
    values = _clean(**fields)
    with db.get_session() as s:
        meal = s.scalar(
            select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
        )
        if meal is None:
            return None
        for column, value in values.items():
            setattr(meal, column, value)
        s.commit()
        return meal


def delete_meal(user_id: str, meal_id: int) -> bool:
    """Remove one of this person's meals. False if it isn't theirs."""
    with db.get_session() as s:
        meal = s.scalar(
            select(Meal).where(Meal.id == meal_id, Meal.user_id == user_id)
        )
        if meal is None:
            return False
        s.delete(meal)
        s.commit()
        return True
