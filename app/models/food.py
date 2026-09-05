"""What was eaten, and what the day is aiming for."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now

KINDS = ("meal", "label")  # a plate described/photographed, or a nutrition label read
SOURCES = ("tfnd", "model", "label", "brand", "saved", "mixed")


class FoodLog(Base):
    """One thing eaten: the words, maybe a photo, and the numbers we settled
    on. `items` keeps the breakdown as JSON text so the numbers can be
    argued with later; `source` says who supplied them."""

    __tablename__ = "food_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    eaten_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    text: Mapped[str] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(16), default="meal")
    kcal: Mapped[float] = mapped_column(Float)
    protein: Mapped[float] = mapped_column(Float)
    carbs: Mapped[float] = mapped_column(Float)
    fat: Mapped[float] = mapped_column(Float)
    items: Mapped[str] = mapped_column(Text, default="[]")
    source: Mapped[str] = mapped_column(String(16), default="model")
    meal_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class FoodItem(Base):
    """A food this person has real numbers for — read off a label or a
    chain's published table — kept per 100 g so it scales to any portion.
    Next time the same name comes up, these win over any estimate."""

    __tablename__ = "food_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    name: Mapped[str] = mapped_column(String(200))
    kcal_100: Mapped[float] = mapped_column(Float)
    protein_100: Mapped[float] = mapped_column(Float)
    carbs_100: Mapped[float] = mapped_column(Float)
    fat_100: Mapped[float] = mapped_column(Float)
    serving_g: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class NutritionTarget(Base):
    __tablename__ = "nutrition_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), unique=True)
    kcal: Mapped[int] = mapped_column(Integer)
    protein: Mapped[int] = mapped_column(Integer)
    carbs: Mapped[int] = mapped_column(Integer)
    fat: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
