"""The "what can I eat" list.

Plain CRUD. The rules live here, not in the routes, so a test can hit them
without HTTP and a future caller (the week planner) gets the same answers:

- a name is required;
- category / source / season / method must be one of the known codes;
- home-cooked needs a method — it is the axis this list gets searched on;
- a rating, if given, is a whole number from 1 to 10;
- a video link, if given, is an http(s) URL;
- proteins are any of beef / pork / chicken / seafood, none or several;
- eating out has no method and no recipe, whatever was sent. Keeping a stale
  method on an eat-out row would make it show up under "air fryer";
- home-cooked has no shop, for the same reason in the other direction.

Every read, update and delete filters on user_id as well as id, so a guessed
id never reaches someone else's row.
"""
from math import asin, cos, radians, sin, sqrt

from sqlalchemy import func, or_, select

from app.core import db
from app.models import MEAL_CATEGORIES, METHODS, PROTEINS, SEASONS, SOURCES, Meal


class MealError(ValueError):
    """The input breaks one of the rules above; the message says which."""


PLACE_FIELDS = ("place_id", "place_name", "address", "phone", "lat", "lng", "maps_url")


def pack_proteins(codes) -> str | None:
    """["chicken","beef"] → ",beef,chicken,"; nothing → None. Unknown codes
    raise: they are picked from buttons, so one is a bug, not a typo."""
    picked = sorted({(c or "").strip() for c in (codes or []) if (c or "").strip()})
    if not picked:
        return None
    for c in picked:
        if c not in PROTEINS:
            raise MealError(f"Unknown protein {c!r}")
    return "," + ",".join(picked) + ","


def unpack_proteins(packed: str | None) -> list[str]:
    return [c for c in (packed or "").split(",") if c]


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
    kind: str | None = None,
    place_id: str | None = None,
    place_name: str | None = None,
    address: str | None = None,
    phone: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    maps_url: str | None = None,
    video_url: str | None = None,
    proteins=None,
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
    video_url = _text(video_url)
    if video_url is not None and not video_url.lower().startswith(("http://", "https://")):
        raise MealError("A video link starts with http:// or https://")

    place = {
        "place_id": _text(place_id),
        "place_name": _text(place_name),
        "address": _text(address),
        "phone": _text(phone),
        "lat": lat,
        "lng": lng,
        "maps_url": _text(maps_url),
    }
    if source == "eat_out":
        method, recipe = None, None
        # Both or neither: one coordinate is not a location.
        if (lat is None) != (lng is None):
            raise MealError("A location needs both lat and lng")
        if lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise MealError("lat/lng out of range")
    else:
        if method not in METHODS:
            raise MealError("A home-cooked meal needs a cooking method")
        recipe = _text(recipe)
        place = dict.fromkeys(PLACE_FIELDS)

    return {
        "name": name,
        "category": category,
        "source": source,
        "season": season,
        "method": method,
        "recipe": recipe,
        "note": _text(note),
        "rating": rating,
        "kind": _text(kind),
        "video_url": video_url,
        "proteins": pack_proteins(proteins),
        **place,
    }


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Straight-line metres between two points (haversine). Not the walk —
    close enough to rank a list of restaurants."""
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return int(round(2 * 6_371_000 * asin(sqrt(a))))


def list_meals(
    user_id: str,
    *,
    q: str | None = None,
    category: str | None = None,
    source: str | None = None,
    season: str | None = None,
    method: str | None = None,
    kind: str | None = None,
    protein: str | None = None,
    near: tuple[float, float] | None = None,
) -> list[Meal]:
    """One person's meals, newest first, narrowed by whichever filters are set.

    Filters combine with AND. A season filter also returns the all-season
    meals — a boiled egg is a summer meal too. `q` is a case-insensitive
    substring match over name, recipe and note. Unknown codes match nothing
    rather than raising: a filter is a question, not an input to store.

    With `near=(lat, lng)`, every meal that has a location gets `distance_m`
    and those come first, nearest first; the rest keep their order after.
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
    if kind and kind.strip():
        stmt = stmt.where(Meal.kind == kind.strip())
    if protein:
        stmt = stmt.where(Meal.proteins.like(f"%,{protein},%"))
    q = (q or "").strip()
    if q:
        # autoescape: "100%" in a note is matched by typing "100%", not by
        # anything at all — the person is searching text, not writing LIKE.
        stmt = stmt.where(
            or_(
                Meal.name.icontains(q, autoescape=True),
                Meal.recipe.icontains(q, autoescape=True),
                Meal.note.icontains(q, autoescape=True),
                Meal.kind.icontains(q, autoescape=True),
            )
        )
    stmt = stmt.order_by(Meal.created_at.desc(), Meal.id.desc())
    with db.get_session() as s:
        rows = list(s.scalars(stmt))
    if near is None:
        return rows
    lat, lng = near
    for m in rows:
        m.distance_m = (
            distance_m(lat, lng, m.lat, m.lng) if m.lat is not None else None
        )
    # Stable sort: located meals by distance, unlocated after, both keeping
    # newest-first within.
    return sorted(rows, key=lambda m: (m.distance_m is None, m.distance_m or 0))


def kinds(user_id: str, source: str | None = None) -> list[tuple[str, int]]:
    """Each kind this person uses and how many meals carry it, most first.
    Meals with no kind are not a kind. `source` narrows to eat-out or
    home-cooked — GO only wants the kinds of places to go."""
    if not user_id:
        return []
    stmt = (
        select(Meal.kind, func.count())
        .where(Meal.user_id == user_id, Meal.kind.is_not(None))
        .group_by(Meal.kind)
        .order_by(func.count().desc(), Meal.kind)
    )
    if source:
        stmt = stmt.where(Meal.source == source)
    with db.get_session() as s:
        return [(k, n) for k, n in s.execute(stmt)]


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
