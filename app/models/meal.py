"""A meal this person has decided is fine to eat while cutting.

The list is a catalogue, not a diary: a meal has no date. A later week-planner
will point at these rows by id, so moving "chicken" from Monday lunch to
Wednesday dinner only ever touches the plan, never the meal.

Values are stored as English codes and shown in Chinese by the frontend, so
the database and the API stay language-neutral.
"""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now

CATEGORIES = ("breakfast", "meal", "snack")
SOURCES = ("eat_out", "home_cooked")
SEASONS = ("summer", "winter", "all")
METHODS = ("stir_fry", "air_fryer", "rice_cooker", "microwave")
PROTEINS = ("beef", "pork", "chicken", "seafood")


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
    # The shop, for eating out — filled from Google Places, so the name is
    # Google's, the coordinates are real, and "nearest" can be computed.
    # All NULL for home-cooked.
    place_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    place_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    maps_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Where the recipe came from — an Instagram reel, a YouTube video. Just
    # the link: the content is not fetched (Instagram has no API for it).
    video_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Which of beef / pork / chicken / seafood it is — several allowed, so a
    # hot pot can be both. Stored as ",beef,chicken," (commas both ends) so a
    # LIKE on ",chicken," is exact; NULL when none.
    proteins: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Free text the person groups by — 火鍋, 牛排, 超商 — so the list can be
    # browsed by kind. A string, not a table: the kinds are theirs to invent.
    kind: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    # Eating out: 1 = under 300, 2 = 400-600, 3 = 800 and up. NULL for home.
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 1-10 stars, or NULL until it has been eaten and judged.
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, onupdate=now
    )
