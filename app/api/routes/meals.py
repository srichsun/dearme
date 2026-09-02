"""The "what can I eat" list, and the notes about how one eats.

Everything here is scoped to the signed-in person; a meal that isn't theirs
answers 404, the same as one that doesn't exist.
"""
from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUid
from app.models import Meal, MealNote
from app.schemas.meal import MealWrite, NoteWrite, SearchRequest
from app.services import meal_notes, meal_search, meals
from app.services.meals import PLACE_FIELDS, MealError

# Under /api so the page at /meals (see app/main.py) and this JSON can't
# collide — the other routers predate the second app and keep their paths.
router = APIRouter(prefix="/api/meals", tags=["meals"])


def _meal(m: Meal) -> dict:
    return {
        "id": m.id,
        "name": m.name,
        "category": m.category,
        "source": m.source,
        "season": m.season,
        "method": m.method,
        "recipe": m.recipe,
        "note": m.note,
        "rating": m.rating,
        "kind": m.kind,
        "video_url": m.video_url,
        "place": (
            {f: getattr(m, f) for f in PLACE_FIELDS} if m.place_name else None
        ),
        "distance_m": getattr(m, "distance_m", None),
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


def _near(value: str | None) -> tuple[float, float] | None:
    """"lat,lng" from the browser's geolocation, or 422 if it isn't one."""
    if not value:
        return None
    try:
        lat, lng = (float(x) for x in value.split(","))
    except ValueError:
        raise HTTPException(status_code=422, detail="near must be lat,lng")
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=422, detail="near out of range")
    return lat, lng


def _note(n: MealNote) -> dict:
    return {"id": n.id, "text": n.text, "created_at": n.created_at.isoformat()}


# --- notes ---
# Nothing here collides with /{meal_id} today (different methods or depths),
# but a GET /meals/{meal_id} would swallow GET /meals/notes if it came first.
# Keeping the notes on top means that mistake can't be made by accident.


@router.get("/notes")
def list_notes(uid: CurrentUid):
    return {"notes": [_note(n) for n in meal_notes.list_notes(uid)]}


@router.post("/notes", status_code=201)
def add_note(req: NoteWrite, uid: CurrentUid):
    note = meal_notes.add_note(uid, req.text)
    if note is None:
        raise HTTPException(status_code=422, detail="A note can't be empty")
    return _note(note)


@router.delete("/notes/{note_id}")
def delete_note(note_id: int, uid: CurrentUid):
    if not meal_notes.delete_note(uid, note_id):
        raise HTTPException(status_code=404, detail="No such note")
    return {"deleted": note_id}


# --- browsing by kind ---


@router.get("/kinds")
def list_kinds(uid: CurrentUid):
    """Every kind in use and its count, most first — the browse screen."""
    return {"kinds": [{"kind": k, "count": n} for k, n in meals.kinds(uid)]}


# --- asking in a sentence ---


@router.post("/search")
def search_meals(req: SearchRequest, uid: CurrentUid):
    """Filters the sentence was read as, and the meals they match. Never
    fails on the model: `fallback` says the sentence was used as a keyword."""
    result = meal_search.search(uid, req.text, near=_near(req.near))
    return {
        "filters": result["filters"],
        "meals": [_meal(m) for m in result["meals"]],
        "fallback": result["fallback"],
    }


# --- meals ---


@router.get("")
def list_meals(
    uid: CurrentUid,
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    season: str | None = Query(default=None),
    method: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    near: str | None = Query(default=None),
):
    rows = meals.list_meals(
        uid, q=q, category=category, source=source, season=season, method=method,
        kind=kind, near=_near(near),
    )
    return {"meals": [_meal(m) for m in rows]}


@router.post("", status_code=201)
def create_meal(req: MealWrite, uid: CurrentUid):
    try:
        meal = meals.create_meal(uid, **req.model_dump())
    except MealError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _meal(meal)


@router.patch("/{meal_id}")
def update_meal(meal_id: int, req: MealWrite, uid: CurrentUid):
    try:
        meal = meals.update_meal(uid, meal_id, **req.model_dump())
    except MealError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if meal is None:
        raise HTTPException(status_code=404, detail="No such meal")
    return _meal(meal)


@router.delete("/{meal_id}")
def delete_meal(meal_id: int, uid: CurrentUid):
    if not meals.delete_meal(uid, meal_id):
        raise HTTPException(status_code=404, detail="No such meal")
    return {"deleted": meal_id}
