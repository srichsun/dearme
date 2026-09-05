"""The food log: what was eaten each day, the day's targets, the report."""
import json
from datetime import date, timedelta

from sqlalchemy import select

from app.core import clock, db
from app.models import FoodLog, NutritionTarget
from app.models.food import KINDS, SOURCES

NUTRIENTS = ("kcal", "protein", "carbs", "fat")
DEFAULT_TARGET = {"kcal": 2500, "protein": 160, "carbs": 280, "fat": 80}


class FoodError(ValueError):
    pass


def _dict(log: FoodLog) -> dict:
    return {
        "id": log.id,
        "day": log.day.isoformat(),
        "eaten_at": log.eaten_at.isoformat(),
        "text": log.text,
        "photo_url": log.photo_url,
        "kind": log.kind,
        "kcal": log.kcal, "protein": log.protein, "carbs": log.carbs, "fat": log.fat,
        "items": json.loads(log.items or "[]"),
        "source": log.source,
        "meal_id": log.meal_id,
    }


def _numbers(values: dict) -> dict:
    out = {}
    for n in NUTRIENTS:
        v = values.get(n)
        if v is None or isinstance(v, bool) or not isinstance(v, (int, float)) or v < 0 or v > 20000:
            raise FoodError(f"{n} must be a number from 0 up")
        out[n] = float(v)
    return out


def add_log(user_id: str, *, text: str, kcal, protein, carbs, fat, kind="meal", items=None,
            source="model", photo_url=None, meal_id=None, day: date | None = None) -> dict:
    text = (text or "").strip()
    if not text:
        raise FoodError("Say what was eaten")
    if kind not in KINDS:
        raise FoodError(f"Unknown kind {kind!r}")
    if source not in SOURCES:
        raise FoodError(f"Unknown source {source!r}")
    numbers = _numbers({"kcal": kcal, "protein": protein, "carbs": carbs, "fat": fat})
    with db.get_session() as s:
        log = FoodLog(
            user_id=user_id, day=day or clock.today(), text=text, kind=kind, source=source,
            items=json.dumps(items or [], ensure_ascii=False), photo_url=photo_url, meal_id=meal_id,
            **numbers,
        )
        s.add(log)
        s.commit()
        return _dict(log)


def update_log(user_id: str, log_id: int, **changes) -> dict | None:
    with db.get_session() as s:
        log = s.scalar(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user_id))
        if log is None:
            return None
        if "text" in changes and changes["text"] is not None:
            text = changes["text"].strip()
            if not text:
                raise FoodError("Say what was eaten")
            log.text = text
        nums = {n: changes[n] for n in NUTRIENTS if changes.get(n) is not None}
        if nums:
            current = {n: getattr(log, n) for n in NUTRIENTS}
            for n, v in _numbers({**current, **nums}).items():
                setattr(log, n, v)
            log.source = "model" if log.source == "label" else log.source  # edited by hand: no longer the label's word
        s.commit()
        return _dict(log)


def delete_log(user_id: str, log_id: int) -> bool:
    with db.get_session() as s:
        log = s.scalar(select(FoodLog).where(FoodLog.id == log_id, FoodLog.user_id == user_id))
        if log is None:
            return False
        s.delete(log)
        s.commit()
        return True


def totals(logs: list[dict]) -> dict:
    return {n: round(sum(x[n] for x in logs), 1 if n != "kcal" else 0) for n in NUTRIENTS}


def day_logs(user_id: str, day: date) -> list[dict]:
    if not user_id:
        return []
    with db.get_session() as s:
        rows = s.scalars(
            select(FoodLog).where(FoodLog.user_id == user_id, FoodLog.day == day).order_by(FoodLog.eaten_at, FoodLog.id)
        )
        return [_dict(r) for r in rows]


def get_targets(user_id: str) -> dict:
    with db.get_session() as s:
        t = s.scalar(select(NutritionTarget).where(NutritionTarget.user_id == user_id))
        return {n: getattr(t, n) for n in NUTRIENTS} if t else dict(DEFAULT_TARGET)


def set_targets(user_id: str, values: dict) -> dict:
    nums = {}
    for n in NUTRIENTS:
        v = values.get(n)
        if isinstance(v, bool) or not isinstance(v, int) or not 0 < v <= 20000:
            raise FoodError(f"{n} target must be a whole number above 0")
        nums[n] = v
    with db.get_session() as s:
        t = s.scalar(select(NutritionTarget).where(NutritionTarget.user_id == user_id))
        if t is None:
            s.add(NutritionTarget(user_id=user_id, **nums))
        else:
            for n, v in nums.items():
                setattr(t, n, v)
        s.commit()
    return nums


def report(user_id: str, days: int) -> dict:
    """The last `days` days ending today: each day's totals (zeros for a
    day with nothing logged), the average over logged days, and how many
    days landed within ±10% of the kcal target."""
    days = max(1, min(days, 90))
    end = clock.today()
    start = end - timedelta(days=days - 1)
    with db.get_session() as s:
        rows = s.scalars(
            select(FoodLog).where(FoodLog.user_id == user_id, FoodLog.day >= start, FoodLog.day <= end)
        )
        by_day: dict[date, list[dict]] = {}
        for r in rows:
            by_day.setdefault(r.day, []).append(_dict(r))
    target = get_targets(user_id)
    series = []
    for i in range(days):
        d = start + timedelta(days=i)
        t = totals(by_day.get(d, []))
        series.append({"day": d.isoformat(), **t, "logged": d in by_day})
    logged = [x for x in series if x["logged"]]
    average = (
        {n: round(sum(x[n] for x in logged) / len(logged), 1 if n != "kcal" else 0) for n in NUTRIENTS}
        if logged else None
    )
    on_target = sum(1 for x in logged if abs(x["kcal"] - target["kcal"]) <= 0.1 * target["kcal"])
    return {"days": series, "average": average, "logged_days": len(logged), "on_target_days": on_target, "targets": target}
