"""The food log: estimate, save, the day, targets, the report."""
from datetime import date

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.api.deps import CurrentUid
from app.core import clock
from app.schemas.food import LogPatch, LogWrite, TargetsWrite
from app.services import blobs, food, food_estimate, food_items
from app.services.food import FoodError

router = APIRouter(prefix="/api/food", tags=["food"])
MAX_PHOTO = 6 * 1024 * 1024


def _day(value: str | None) -> date:
    if not value:
        return clock.today()
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail="day must be YYYY-MM-DD")


@router.get("")
def the_day(uid: CurrentUid, day: str | None = Query(default=None)):
    d = _day(day)
    logs = food.day_logs(uid, d)
    return {"day": d.isoformat(), "logs": logs, "totals": food.totals(logs), "targets": food.get_targets(uid)}


@router.post("/estimate")
async def estimate(
    uid: CurrentUid,
    text: str = Form(""),
    kind: str = Form("meal"),
    photo: UploadFile | None = File(default=None),
):
    """Words and/or a photo in, numbers out. Nothing is saved; the photo is
    stored so the save can point at it."""
    if kind not in ("meal", "label"):
        raise HTTPException(status_code=422, detail="kind is meal or label")
    data = await photo.read() if photo else None
    if not (text or "").strip() and not data:
        raise HTTPException(status_code=422, detail="Say or show what was eaten")
    if data and len(data) > MAX_PHOTO:
        raise HTTPException(status_code=422, detail="Photo too large")
    if data and not (photo.content_type or "").startswith("image/"):
        raise HTTPException(status_code=422, detail="Only image files")
    try:
        result = food_estimate.estimate(text, data, photo.content_type if photo else "image/jpeg", kind, uid)
    except Exception:  # noqa: BLE001 — the model is the one thing here that fails in the wild
        raise HTTPException(status_code=502, detail="Could not estimate this one; try again or type the numbers")
    photo_url = None
    if data:
        try:
            _, photo_url = blobs.upload(f"food/{uid[:8]}", data, photo.content_type, ".jpg")
        except Exception:  # noqa: BLE001 — a lost photo should not lose the numbers
            photo_url = None
    return {**result, "photo_url": photo_url, "kind": kind}


@router.post("", status_code=201)
def add_log(req: LogWrite, uid: CurrentUid):
    try:
        return food.add_log(uid, **req.model_dump())
    except FoodError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.patch("/{log_id}")
def update_log(log_id: int, req: LogPatch, uid: CurrentUid):
    try:
        log = food.update_log(uid, log_id, **req.model_dump())
    except FoodError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if log is None:
        raise HTTPException(status_code=404, detail="No such entry")
    return log


@router.delete("/{log_id}")
def delete_log(log_id: int, uid: CurrentUid):
    if not food.delete_log(uid, log_id):
        raise HTTPException(status_code=404, detail="No such entry")
    return {"deleted": log_id}


@router.get("/items")
def my_items(uid: CurrentUid):
    """The foods this person has real numbers for."""
    return {"items": food_items.list_items(uid)}


@router.delete("/items/{item_id}")
def forget_item(item_id: int, uid: CurrentUid):
    if not food_items.forget(uid, item_id):
        raise HTTPException(status_code=404, detail="No such item")
    return {"deleted": item_id}


@router.get("/targets")
def get_targets(uid: CurrentUid):
    return food.get_targets(uid)


@router.put("/targets")
def put_targets(req: TargetsWrite, uid: CurrentUid):
    try:
        return food.set_targets(uid, req.model_dump())
    except FoodError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/report")
def the_report(uid: CurrentUid, days: int = Query(default=7, ge=1, le=90)):
    return food.report(uid, days)
