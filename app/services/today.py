"""The first screen: a goal, and the few things to do every day.

Plain CRUD, no LLM. Checks are per Taiwan day, so "done" is only ever about
today; yesterday's check stays in the table and does nothing to today.
Every habit query filters on user_id as well as id.
"""
from sqlalchemy import delete, select

from app.core import clock, db
from app.models import Goal, Habit, HabitCheck

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


def add_starter(user_id: str) -> list[dict]:
    """The starter list — only onto an empty one, so pressing twice can't
    double it."""
    if not list_habits(user_id):
        for text in STARTER:
            add_habit(user_id, text)
    return list_habits(user_id)
