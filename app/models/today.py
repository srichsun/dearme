"""The first screen: a goal in the person's own words, and the few things
they mean to do every day.

A habit is checked per Taiwan day (HabitCheck), so the list resets each
morning on its own and the history stays for a streak later.
"""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), unique=True)
    text: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )


class Habit(Base):
    __tablename__ = "habits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class HabitCheck(Base):
    __tablename__ = "habit_checks"
    __table_args__ = (UniqueConstraint("habit_id", "day", name="uq_habit_checks_habit_day"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    habit_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("habits.id", ondelete="CASCADE"), index=True
    )
    day: Mapped[date] = mapped_column(Date)
