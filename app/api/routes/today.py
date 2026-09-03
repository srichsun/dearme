"""The first screen: goal and daily checklist, scoped to the signed-in person."""
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.api.deps import CurrentUid
from app.core import clock
from app.schemas.today import FocusWrite, GoalWrite, HabitWrite
from app.services import rewards, today
from app.services.rewards import LockedError, RewardError

router = APIRouter(prefix="/api/today", tags=["today"])


@router.get("")
def get_today(uid: CurrentUid):
    return {
        "goal": today.get_goal(uid),
        "day": clock.today().isoformat(),
        "habits": today.list_habits(uid),
        "principles": today.list_principles(uid),
        "focus": today.get_focus(uid),
    }


@router.put("/focus")
def put_focus(req: FocusWrite, uid: CurrentUid):
    return {"focus": today.set_focus(uid, req.text)}


@router.post("/focus/done")
def focus_done(uid: CurrentUid):
    f = today.set_focus_done(uid, True)
    if f is None:
        raise HTTPException(status_code=404, detail="No focus today")
    return {"focus": f}


@router.delete("/focus/done")
def focus_undone(uid: CurrentUid):
    f = today.set_focus_done(uid, False)
    if f is None:
        raise HTTPException(status_code=404, detail="No focus today")
    return {"focus": f}


# --- reward videos ---


@router.get("/rewards")
def list_rewards(uid: CurrentUid):
    return {"videos": rewards.list_videos(uid)}


@router.get("/rewards/today")
def todays_reward(uid: CurrentUid):
    return rewards.status(uid)


@router.post("/rewards/unlock")
def unlock_reward(uid: CurrentUid):
    """Earn today's clip. 409 while the list isn't all ticked; 404 with no clips."""
    try:
        return rewards.unlock(uid)
    except LockedError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except RewardError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/rewards", status_code=201)
async def add_reward(uid: CurrentUid, video: UploadFile = File(...), title: str = Form("")):
    data = await video.read()
    try:
        return rewards.add_video(uid, data, video.content_type or "", title)
    except RewardError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/rewards/{video_id}")
def delete_reward(video_id: int, uid: CurrentUid):
    if not rewards.delete_video(uid, video_id):
        raise HTTPException(status_code=404, detail="No such video")
    return {"deleted": video_id}


@router.get("/principles")
def list_principles(uid: CurrentUid):
    return {"principles": today.list_principles(uid)}


@router.post("/principles", status_code=201)
def add_principle(req: HabitWrite, uid: CurrentUid):
    p = today.add_principle(uid, req.text)
    if p is None:
        raise HTTPException(status_code=422, detail="A principle can't be empty")
    return {"id": p.id, "text": p.text}


@router.patch("/principles/{principle_id}")
def rename_principle(principle_id: int, req: HabitWrite, uid: CurrentUid):
    if not (req.text or "").strip():
        raise HTTPException(status_code=422, detail="A principle can't be empty")
    p = today.rename_principle(uid, principle_id, req.text)
    if p is None:
        raise HTTPException(status_code=404, detail="No such principle")
    return {"id": p.id, "text": p.text}


@router.delete("/principles/{principle_id}")
def delete_principle(principle_id: int, uid: CurrentUid):
    if not today.delete_principle(uid, principle_id):
        raise HTTPException(status_code=404, detail="No such principle")
    return {"deleted": principle_id}


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
