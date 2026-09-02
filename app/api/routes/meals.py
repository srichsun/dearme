"""The "what can I eat" list, and the notes about how one eats.

Everything here is scoped to the signed-in person; a meal that isn't theirs
answers 404, the same as one that doesn't exist.
"""
from fastapi import APIRouter, HTTPException, Query

from app.api.deps import CurrentUid
from app.models import Meal, MealNote
from app.schemas.meal import MealWrite, NoteWrite
from app.services import meal_notes, meals
from app.services.meals import MealError

router = APIRouter(prefix="/meals", tags=["meals"])


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
        "created_at": m.created_at.isoformat(),
        "updated_at": m.updated_at.isoformat(),
    }


def _note(n: MealNote) -> dict:
    return {"id": n.id, "text": n.text, "created_at": n.created_at.isoformat()}


# --- notes ---
# Declared before /{meal_id} so "notes" is never read as a meal id.


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


# --- meals ---


@router.get("")
def list_meals(
    uid: CurrentUid,
    q: str | None = Query(default=None),
    category: str | None = Query(default=None),
    source: str | None = Query(default=None),
    season: str | None = Query(default=None),
    method: str | None = Query(default=None),
):
    rows = meals.list_meals(
        uid, q=q, category=category, source=source, season=season, method=method
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
