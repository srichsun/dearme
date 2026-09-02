"""The first screen: goal and daily checklist, scoped to the signed-in person."""
from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUid
from app.core import clock
from app.schemas.today import GoalWrite, HabitWrite
from app.services import today

router = APIRouter(prefix="/api/today", tags=["today"])


@router.get("")
def get_today(uid: CurrentUid):
    return {
        "goal": today.get_goal(uid),
        "day": clock.today().isoformat(),
        "habits": today.list_habits(uid),
    }


@router.put("/goal")
def put_goal(req: GoalWrite, uid: CurrentUid):
    return {"goal": today.set_goal(uid, req.text)}


@router.post("/habits", status_code=201)
def add_habit(req: HabitWrite, uid: CurrentUid):
    habit = today.add_habit(uid, req.text)
    if habit is None:
        raise HTTPException(status_code=422, detail="A habit can't be empty")
    return {"id": habit.id, "text": habit.text, "done": False}


@router.post("/habits/starter")
def add_starter(uid: CurrentUid):
    return {"habits": today.add_starter(uid)}


@router.patch("/habits/{habit_id}")
def rename_habit(habit_id: int, req: HabitWrite, uid: CurrentUid):
    if not (req.text or "").strip():
        raise HTTPException(status_code=422, detail="A habit can't be empty")
    habit = today.rename_habit(uid, habit_id, req.text)
    if habit is None:
        raise HTTPException(status_code=404, detail="No such habit")
    return {"id": habit.id, "text": habit.text}


@router.delete("/habits/{habit_id}")
def delete_habit(habit_id: int, uid: CurrentUid):
    if not today.delete_habit(uid, habit_id):
        raise HTTPException(status_code=404, detail="No such habit")
    return {"deleted": habit_id}


@router.post("/habits/{habit_id}/check")
def check(habit_id: int, uid: CurrentUid):
    if today.set_done(uid, habit_id, True) is None:
        raise HTTPException(status_code=404, detail="No such habit")
    return {"id": habit_id, "done": True}


@router.delete("/habits/{habit_id}/check")
def uncheck(habit_id: int, uid: CurrentUid):
    if today.set_done(uid, habit_id, False) is None:
        raise HTTPException(status_code=404, detail="No such habit")
    return {"id": habit_id, "done": False}
