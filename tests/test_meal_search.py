"""Tests for asking the meals list in a sentence.

The model is faked: what's checked is that its answer becomes the same query
the filters use, that odd answers lose only the odd part, and that a dead
model still returns a list.
"""
import pytest
from fastapi.testclient import TestClient

from app.core import security as auth
from app.main import app
from app.services import meal_search, meals

client = TestClient(app)

UID = "u-search"


def _fake_parser(monkeypatch, answer=None, error=None, seen=None):
    """Make the model return `answer` (a _Filters) or raise `error`."""

    class _Model:
        def invoke(self, prompt):
            if seen is not None:
                seen.append(prompt)
            if error is not None:
                raise error
            return answer

    monkeypatch.setattr(meal_search, "_parser", _Model())


@pytest.fixture
def a_few_meals(sqlite_db):
    meals.create_meal(UID, name="氣炸鍋雞胸", category="meal", source="home_cooked",
                      season="summer", method="air_fryer")
    meals.create_meal(UID, name="7-11 茶葉蛋", category="snack", source="eat_out",
                      season="all")
    meals.create_meal(UID, name="電鍋雞湯", category="meal", source="home_cooked",
                      season="winter", method="rice_cooker")


def names(result):
    return [m.name for m in result["meals"]]


def test_the_models_filters_run_the_ordinary_query(a_few_meals, monkeypatch):
    seen = []
    _fake_parser(
        monkeypatch,
        meal_search._Filters(source="home_cooked", season="summer", method="air_fryer"),
        seen=seen,
    )

    result = meal_search.search(UID, "夏天自己煮的 用氣炸鍋")

    assert result["filters"] == {
        "source": "home_cooked", "season": "summer", "method": "air_fryer",
    }
    assert names(result) == ["氣炸鍋雞胸"]
    assert result["fallback"] is False
    assert "夏天自己煮的 用氣炸鍋" in seen[0]


def test_a_keyword_from_the_model_is_searched_too(a_few_meals, monkeypatch):
    _fake_parser(monkeypatch, meal_search._Filters(q="雞", source="home_cooked"))

    result = meal_search.search(UID, "自己煮的雞")

    assert result["filters"] == {"q": "雞", "source": "home_cooked"}
    assert names(result) == ["電鍋雞湯", "氣炸鍋雞胸"]


def test_an_unknown_code_drops_only_that_filter(a_few_meals, monkeypatch):
    _fake_parser(monkeypatch, meal_search._Filters(category="dinner", season="all",
                                                   method="rice_cooker", q="  "))

    result = meal_search.search(UID, "冬天晚餐電鍋")

    assert result["filters"] == {"method": "rice_cooker"}
    assert names(result) == ["電鍋雞湯"]
    assert result["fallback"] is False


def test_a_dead_model_falls_back_to_the_sentence_as_keyword(a_few_meals, monkeypatch):
    _fake_parser(monkeypatch, error=TimeoutError("model down"))

    result = meal_search.search(UID, "雞")

    assert result["filters"] == {"q": "雞"}
    assert names(result) == ["電鍋雞湯", "氣炸鍋雞胸"]
    assert result["fallback"] is True


def test_a_blank_sentence_never_calls_the_model(a_few_meals, monkeypatch):
    seen = []
    _fake_parser(monkeypatch, error=AssertionError("should not be called"), seen=seen)

    result = meal_search.search(UID, "   ")

    assert seen == []
    assert result["filters"] == {}
    assert len(result["meals"]) == 3


def test_the_search_stays_inside_one_account(sqlite_db, monkeypatch):
    meals.create_meal("someone-else", name="別人的雞胸", category="meal",
                      source="eat_out", season="all")
    _fake_parser(monkeypatch, meal_search._Filters(q="雞"))

    assert names(meal_search.search(UID, "雞")) == []


# --- the route ---

def test_the_route_returns_filters_meals_and_fallback(a_few_meals, monkeypatch):
    app.dependency_overrides[auth.current_user_uid] = lambda: UID
    try:
        _fake_parser(monkeypatch, meal_search._Filters(season="winter"))

        resp = client.post("/api/meals/search", json={"text": "冬天"})

        assert resp.status_code == 200
        body = resp.json()
        assert body["filters"] == {"season": "winter"}
        assert [m["name"] for m in body["meals"]] == ["電鍋雞湯", "7-11 茶葉蛋"]
        assert body["fallback"] is False
    finally:
        app.dependency_overrides.pop(auth.current_user_uid, None)


def test_the_route_needs_a_sign_in(sqlite_db):
    assert client.post("/api/meals/search", json={"text": "雞"}).status_code == 401
