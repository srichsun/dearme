"""Tests for the "what can I eat" list."""
from sqlalchemy import select

from app.core import db
from app.models import Meal


def test_a_meal_round_trips_through_the_table(sqlite_db):
    with db.get_session() as s:
        s.add(
            Meal(
                user_id="u1",
                name="氣炸鍋雞胸",
                category="meal",
                source="home_cooked",
                season="summer",
                method="air_fryer",
                recipe="雞胸抹鹽\n氣炸 180 度 15 分",
            )
        )
        s.commit()

    with db.get_session() as s:
        meal = s.scalar(select(Meal).where(Meal.user_id == "u1"))

    assert meal.name == "氣炸鍋雞胸"
    assert meal.method == "air_fryer"
    assert meal.note is None
    assert meal.created_at is not None
    assert meal.updated_at is not None
