"""A meal this person has decided is fine to eat while cutting.

The list is a catalogue, not a diary: a meal has no date. A later week-planner
will point at these rows by id, so moving "chicken" from Monday lunch to
Wednesday dinner only ever touches the plan, never the meal.

Values are stored as English codes and shown in Chinese by the frontend, so
the database and the API stay language-neutral.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now

CATEGORIES = ("breakfast", "meal", "snack")
SOURCES = ("eat_out", "home_cooked")
SEASONS = ("summer", "winter", "all")
METHODS = ("stir_fry", "air_fryer", "rice_cooker", "microwave")


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(32))
    source: Mapped[str] = mapped_column(String(32))
    season: Mapped[str] = mapped_column(String(32))
    # Only a home-cooked meal has a method; eating out stores NULL.
    method: Mapped[str | None] = mapped_column(String(32), nullable=True)
    recipe: Mapped[str | None] = mapped_column(Text, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
