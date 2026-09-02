"""Something this person noticed about how they eat, in their own words.

"The 7-11 healthy box — I just never want it." "Oats in the morning don't do
it for me: not fragrant, not oily." These are kept exactly as said, because
they are the raw material a later step will condense into patterns, and a
pattern drawn from paraphrased notes is a pattern about the paraphrase.

Not tied to a meal on purpose: most of these are about eating, not a dish.
"""
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, now


class MealNote(Base):
    __tablename__ = "meal_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[str] = mapped_column(String(128), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, index=True
    )
