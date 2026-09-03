"""The first screen: a goal, and the few things to do every day.

Plain CRUD, no LLM. Checks are per Taiwan day, so "done" is only ever about
today; yesterday's check stays in the table and does nothing to today.
Every habit query filters on user_id as well as id.
"""
from sqlalchemy import delete, select

from app.core import clock, db
from app.models import Focus, Goal, Habit, HabitCheck, Principle
from app.models.base import now

# What a new list starts with, when the person asks for it.
STARTER = (
    "不要給自己壓力，專注感恩今天",
    "吃 2500 大卡",
    "重訓",
    "10 點關機準備睡覺",
    "10000 步",
)


def get_goal(user_id: str) -> str | None:
    with db.get_session() as s:
        goal = s.scalar(select(Goal).where(Goal.user_id == user_id))
        return goal.text if goal else None


def set_goal(user_id: str, text: str) -> str | None:
    """Write the goal. Blank removes it — a goal is either said or not."""
    text = (text or "").strip()
    with db.get_session() as s:
        goal = s.scalar(select(Goal).where(Goal.user_id == user_id))
        if not text:
            if goal is not None:
                s.delete(goal)
                s.commit()
            return None
        if goal is None:
            s.add(Goal(user_id=user_id, text=text))
        else:
            goal.text = text
        s.commit()
        return text


def list_habits(user_id: str) -> list[dict]:
    """This person's habits in order, each with whether it is done today."""
    if not user_id:
        return []
    today = clock.today()
    with db.get_session() as s:
        rows = list(
            s.scalars(
                select(Habit)
                .where(Habit.user_id == user_id)
                .order_by(Habit.position, Habit.id)
            )
        )
        done = set(
            s.scalars(
                select(HabitCheck.habit_id).where(
                    HabitCheck.habit_id.in_([h.id for h in rows]),
                    HabitCheck.day == today,
                )
            )
        )
    return [{"id": h.id, "text": h.text, "done": h.id in done} for h in rows]


def add_habit(user_id: str, text: str) -> Habit | None:
    text = (text or "").strip()
    if not text:
        return None
    with db.get_session() as s:
        last = s.scalar(
            select(Habit.position)
            .where(Habit.user_id == user_id)
            .order_by(Habit.position.desc())
            .limit(1)
        )
        habit = Habit(user_id=user_id, text=text, position=(last or 0) + 1)
        s.add(habit)
        s.commit()
        return habit


def _own(s, user_id: str, habit_id: int) -> Habit | None:
    return s.scalar(select(Habit).where(Habit.id == habit_id, Habit.user_id == user_id))


def rename_habit(user_id: str, habit_id: int, text: str) -> Habit | None:
    text = (text or "").strip()
    if not text:
        return None
    with db.get_session() as s:
        habit = _own(s, user_id, habit_id)
        if habit is None:
            return None
        habit.text = text
        s.commit()
        return habit


def delete_habit(user_id: str, habit_id: int) -> bool:
    with db.get_session() as s:
        habit = _own(s, user_id, habit_id)
        if habit is None:
            return False
        # SQLite in tests does not enforce the cascade; do it by hand.
        s.execute(delete(HabitCheck).where(HabitCheck.habit_id == habit_id))
        s.delete(habit)
        s.commit()
        return True


def set_done(user_id: str, habit_id: int, done: bool) -> bool | None:
    """Tick or untick for today. None if the habit isn't theirs."""
    today = clock.today()
    with db.get_session() as s:
        if _own(s, user_id, habit_id) is None:
            return None
        existing = s.scalar(
            select(HabitCheck).where(HabitCheck.habit_id == habit_id, HabitCheck.day == today)
        )
        if done and existing is None:
            s.add(HabitCheck(habit_id=habit_id, day=today))
        elif not done and existing is not None:
            s.delete(existing)
        s.commit()
        return done


# --- the one focus ---


def _focus_dict(f: Focus | None) -> dict | None:
    if f is None:
        return None
    return {
        "text": f.text,
        "done": f.done_at is not None,
        "done_at": f.done_at.isoformat() if f.done_at else None,
        "created_at": f.created_at.isoformat(),
    }


def get_focus(user_id: str) -> dict | None:
    with db.get_session() as s:
        return _focus_dict(s.scalar(select(Focus).where(Focus.user_id == user_id, Focus.day == clock.today())))


def set_focus(user_id: str, text: str) -> dict | None:
    """Decide today's one thing. Blank removes it. Rewording keeps the
    done mark and the time it was first decided."""
    text = (text or "").strip()
    with db.get_session() as s:
        f = s.scalar(select(Focus).where(Focus.user_id == user_id, Focus.day == clock.today()))
        if not text:
            if f is not None:
                s.delete(f)
                s.commit()
            return None
        if f is None:
            f = Focus(user_id=user_id, day=clock.today(), text=text)
            s.add(f)
        else:
            f.text = text
        s.commit()
        return _focus_dict(f)


def set_focus_done(user_id: str, done: bool) -> dict | None:
    """Mark today's focus done (stamping the moment) or not. None if there
    is no focus today."""
    with db.get_session() as s:
        f = s.scalar(select(Focus).where(Focus.user_id == user_id, Focus.day == clock.today()))
        if f is None:
            return None
        if done and f.done_at is None:
            f.done_at = now()
        elif not done:
            f.done_at = None
        s.commit()
        return _focus_dict(f)


# --- golden rules ---


def list_principles(user_id: str) -> list[dict]:
    if not user_id:
        return []
    with db.get_session() as s:
        rows = s.scalars(
            select(Principle).where(Principle.user_id == user_id).order_by(Principle.position, Principle.id)
        )
        return [{"id": p.id, "text": p.text} for p in rows]


def add_principle(user_id: str, text: str) -> Principle | None:
    text = (text or "").strip()
    if not text:
        return None
    with db.get_session() as s:
        last = s.scalar(
            select(Principle.position).where(Principle.user_id == user_id)
            .order_by(Principle.position.desc()).limit(1)
        )
        p = Principle(user_id=user_id, text=text, position=(last or 0) + 1)
        s.add(p)
        s.commit()
        return p


def rename_principle(user_id: str, principle_id: int, text: str) -> Principle | None:
    text = (text or "").strip()
    if not text:
        return None
    with db.get_session() as s:
        p = s.scalar(select(Principle).where(Principle.id == principle_id, Principle.user_id == user_id))
        if p is None:
            return None
        p.text = text
        s.commit()
        return p


def delete_principle(user_id: str, principle_id: int) -> bool:
    with db.get_session() as s:
        p = s.scalar(select(Principle).where(Principle.id == principle_id, Principle.user_id == user_id))
        if p is None:
            return False
        s.delete(p)
        s.commit()
        return True


def add_starter(user_id: str) -> list[dict]:
    """The starter list — only onto an empty one, so pressing twice can't
    double it."""
    if not list_habits(user_id):
        for text in STARTER:
            add_habit(user_id, text)
    return list_habits(user_id)
