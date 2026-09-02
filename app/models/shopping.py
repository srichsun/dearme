"""The shopping list: what to buy, in five sections, ticked when bought."""
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now

SECTIONS = ("protein", "carbs", "drinks", "snacks", "fruit")


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    section: Mapped[str] = mapped_column(String(32))
    text: Mapped[str] = mapped_column(Text)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
