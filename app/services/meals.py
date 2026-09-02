"""The "what can I eat" list.

Plain CRUD. The rules live here, not in the routes, so a test can hit them
without HTTP and a future caller (the week planner) gets the same answers:

- a name is required;
- category / source / season / method must be one of the known codes;
- home-cooked needs a method — it is the axis this list gets searched on;
- a rating, if given, is a whole number from 1 to 10;
- eating out has no method and no recipe, whatever was sent. Keeping a stale
  method on an eat-out row would make it show up under "air fryer".

Every read, update and delete filters on user_id as well as id, so a guessed
id never reaches someone else's row.
"""
from sqlalchemy import or_, select

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
    rating: int | None = None,
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
    # bool is an int in Python; True as a rating would be nonsense, not 1.
    if rating is not None and (
        isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 10
    ):
        raise MealError("A rating is a whole number from 1 to 10")

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
        "rating": rating,
    }


def list_meals(
    user_id: str,
    *,
    q: str | None = None,
    category: str | None = None,
    source: str | None = None,
    season: str | None = None,
    method: str | None = None,
) -> list[Meal]:
    """One person's meals, newest first, narrowed by whichever filters are set.

    Filters combine with AND. A season filter also returns the all-season
    meals — a boiled egg is a summer meal too. `q` is a case-insensitive
    substring match over name, recipe and note. Unknown codes match nothing
    rather than raising: a filter is a question, not an input to store.
    """
    if not user_id:
        return []
    stmt = select(Meal).where(Meal.user_id == user_id)
    if category:
        stmt = stmt.where(Meal.category == category)
    if source:
        stmt = stmt.where(Meal.source == source)
    if season:
        # Only a real season widens to the all-season rows; an unknown code
        # must match nothing, not everything marked "all".
        wanted = (season, "all") if season in SEASONS else (season,)
        stmt = stmt.where(Meal.season.in_(wanted))
    if method:
        stmt = stmt.where(Meal.method == method)
    q = (q or "").strip()
    if q:
        # autoescape: "100%" in a note is matched by typing "100%", not by
        # anything at all — the person is searching text, not writing LIKE.
        stmt = stmt.where(
            or_(
                Meal.name.icontains(q, autoescape=True),
                Meal.recipe.icontains(q, autoescape=True),
                Meal.note.icontains(q, autoescape=True),
            )
        )
    stmt = stmt.order_by(Meal.created_at.desc(), Meal.id.desc())
    with db.get_session() as s:
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
