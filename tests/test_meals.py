"""Tests for the "what can I eat" list.

No LLM here. What matters: the rules about what a meal must look like, and
that one account can never reach another's meals.
"""
import pytest
from sqlalchemy import select

from app.core import db
from app.models import Meal
from app.services import meals
from app.services.meals import MealError

CHICKEN = dict(
    name="氣炸鍋雞胸",
    category="meal",
    source="home_cooked",
    season="summer",
    method="air_fryer",
    recipe="雞胸抹鹽\n氣炸 180 度 15 分",
)
EGG = dict(name="7-11 茶葉蛋", category="snack", source="eat_out", season="all")


def test_a_meal_round_trips_through_the_table(sqlite_db):
    with db.get_session() as s:
        s.add(Meal(user_id="u1", **CHICKEN))
        s.commit()

    with db.get_session() as s:
        meal = s.scalar(select(Meal).where(Meal.user_id == "u1"))

    assert meal.name == "氣炸鍋雞胸"
    assert meal.method == "air_fryer"
    assert meal.note is None
    assert meal.created_at is not None
    assert meal.updated_at is not None


# --- creating ---

def test_creating_stores_every_field(sqlite_db):
    meal = meals.create_meal("u1", **CHICKEN, note="  週日備餐  ")

    assert meal.id is not None
    assert meal.category == "meal"
    assert meal.season == "summer"
    assert meal.recipe == "雞胸抹鹽\n氣炸 180 度 15 分"
    assert meal.note == "週日備餐"


def test_name_is_trimmed_and_required(sqlite_db):
    assert meals.create_meal("u1", **{**EGG, "name": "  茶葉蛋  "}).name == "茶葉蛋"
    for blank in ("", "   ", None):
        with pytest.raises(MealError):
            meals.create_meal("u1", **{**EGG, "name": blank})
    assert len(meals.list_meals("u1")) == 1


@pytest.mark.parametrize(
    "field, bad",
    [("category", "lunch"), ("source", "delivery"), ("season", "spring"), ("method", "oven")],
)
def test_unknown_codes_are_rejected(sqlite_db, field, bad):
    with pytest.raises(MealError):
        meals.create_meal("u1", **{**CHICKEN, field: bad})
    assert meals.list_meals("u1") == []


def test_home_cooked_needs_a_method(sqlite_db):
    with pytest.raises(MealError):
        meals.create_meal("u1", **{**CHICKEN, "method": None})
    with pytest.raises(MealError):
        meals.create_meal("u1", **{**CHICKEN, "method": ""})


def test_eating_out_drops_method_and_recipe(sqlite_db):
    """A stale method on an eat-out row would show up under 'air fryer'."""
    meal = meals.create_meal(
        "u1", **EGG, method="air_fryer", recipe="won't be kept"
    )

    assert meal.method is None
    assert meal.recipe is None


def test_blank_recipe_and_note_are_stored_as_none(sqlite_db):
    meal = meals.create_meal("u1", **{**CHICKEN, "recipe": "  "}, note="")

    assert meal.recipe is None
    assert meal.note is None


# --- updating and deleting ---

def test_updating_replaces_every_field(sqlite_db):
    meal = meals.create_meal("u1", **CHICKEN, note="備餐")

    updated = meals.update_meal("u1", meal.id, **EGG)

    assert updated.name == "7-11 茶葉蛋"
    assert updated.source == "eat_out"
    assert updated.method is None
    assert updated.recipe is None
    assert updated.note is None
    assert meals.get_meal("u1", meal.id).name == "7-11 茶葉蛋"


def test_a_bad_update_changes_nothing(sqlite_db):
    meal = meals.create_meal("u1", **CHICKEN)

    with pytest.raises(MealError):
        meals.update_meal("u1", meal.id, **{**EGG, "name": ""})

    assert meals.get_meal("u1", meal.id).name == "氣炸鍋雞胸"


def test_deleting_removes_it(sqlite_db):
    meal = meals.create_meal("u1", **CHICKEN)

    assert meals.delete_meal("u1", meal.id) is True
    assert meals.list_meals("u1") == []
    assert meals.get_meal("u1", meal.id) is None


def test_newest_comes_first(sqlite_db):
    meals.create_meal("u1", **CHICKEN)
    meals.create_meal("u1", **EGG)

    assert [m.name for m in meals.list_meals("u1")] == ["7-11 茶葉蛋", "氣炸鍋雞胸"]


# --- narrowing the list ---

@pytest.fixture
def a_few_meals(sqlite_db):
    """Four meals for u1 that differ on every axis, plus one for u2."""
    meals.create_meal("u1", **CHICKEN)  # meal / home_cooked / summer / air_fryer
    meals.create_meal("u1", **EGG)  # snack / eat_out / all
    meals.create_meal(
        "u1",
        name="電鍋雞湯",
        category="meal",
        source="home_cooked",
        season="winter",
        method="rice_cooker",
        note="很暖",
    )
    meals.create_meal(
        "u1",
        name="燕麥高蛋白",
        category="breakfast",
        source="home_cooked",
        season="all",
        method="microwave",
        recipe="燕麥加水微波 2 分鐘",
    )
    meals.create_meal("u2", name="別人的雞胸", category="meal", source="eat_out", season="all")


def names(**filters):
    return [m.name for m in meals.list_meals("u1", **filters)]


def test_no_filters_returns_everything_newest_first(a_few_meals):
    assert names() == ["燕麥高蛋白", "電鍋雞湯", "7-11 茶葉蛋", "氣炸鍋雞胸"]


def test_filter_by_category(a_few_meals):
    assert names(category="breakfast") == ["燕麥高蛋白"]
    assert names(category="meal") == ["電鍋雞湯", "氣炸鍋雞胸"]


def test_filter_by_source(a_few_meals):
    assert names(source="eat_out") == ["7-11 茶葉蛋"]


def test_filter_by_method(a_few_meals):
    assert names(method="rice_cooker") == ["電鍋雞湯"]


def test_a_season_includes_the_all_season_meals(a_few_meals):
    assert names(season="summer") == ["燕麥高蛋白", "7-11 茶葉蛋", "氣炸鍋雞胸"]
    assert names(season="winter") == ["燕麥高蛋白", "電鍋雞湯", "7-11 茶葉蛋"]
    assert names(season="all") == ["燕麥高蛋白", "7-11 茶葉蛋"]


def test_filters_combine_with_and(a_few_meals):
    assert names(source="home_cooked", season="summer") == ["燕麥高蛋白", "氣炸鍋雞胸"]
    assert names(source="home_cooked", season="summer", method="air_fryer") == ["氣炸鍋雞胸"]


def test_keyword_searches_name_recipe_and_note(a_few_meals):
    assert names(q="雞") == ["電鍋雞湯", "氣炸鍋雞胸"]
    assert names(q="微波") == ["燕麥高蛋白"]  # only in the recipe
    assert names(q="很暖") == ["電鍋雞湯"]  # only in the note


def test_keyword_ignores_case_and_stray_space(a_few_meals):
    assert names(q="  7-11 ") == ["7-11 茶葉蛋"]
    meals.create_meal("u1", **{**EGG, "name": "Subway 沙拉"})
    assert names(q="subway") == ["Subway 沙拉"]


def test_keyword_combines_with_filters(a_few_meals):
    assert names(q="雞", method="air_fryer") == ["氣炸鍋雞胸"]
    assert names(q="雞", source="eat_out") == []


def test_unknown_codes_match_nothing(a_few_meals):
    assert names(category="lunch") == []
    assert names(season="spring") == []


def test_filters_never_cross_accounts(a_few_meals):
    assert names(q="別人") == []


# --- one account must never reach another's meals ---

def test_listing_is_scoped_to_one_person(sqlite_db):
    meals.create_meal("u1", **CHICKEN)
    meals.create_meal("u2", **EGG)

    assert [m.name for m in meals.list_meals("u1")] == ["氣炸鍋雞胸"]
    assert meals.list_meals("") == []


def test_someone_elses_meal_cannot_be_read(sqlite_db):
    theirs = meals.create_meal("u2", **EGG)

    assert meals.get_meal("u1", theirs.id) is None


def test_someone_elses_meal_cannot_be_updated(sqlite_db):
    theirs = meals.create_meal("u2", **EGG)

    assert meals.update_meal("u1", theirs.id, **CHICKEN) is None
    assert meals.get_meal("u2", theirs.id).name == "7-11 茶葉蛋"


def test_someone_elses_meal_cannot_be_deleted(sqlite_db):
    theirs = meals.create_meal("u2", **EGG)

    assert meals.delete_meal("u1", theirs.id) is False
    assert len(meals.list_meals("u2")) == 1
