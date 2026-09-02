"""Meals route tests — the HTTP glue over the service.

The rules themselves are tested against the service; here it's the status
codes, the shape of what comes back, and that /meals/notes is not mistaken
for a meal called "notes".
"""
import pytest
from fastapi.testclient import TestClient

from app.core import security as auth
from app.main import app
from app.services import meal_notes, meals

client = TestClient(app)

UID = "u-meals"

CHICKEN = {
    "name": "氣炸鍋雞胸",
    "category": "meal",
    "source": "home_cooked",
    "season": "summer",
    "method": "air_fryer",
    "recipe": "抹鹽，氣炸 15 分",
}
EGG = {"name": "7-11 茶葉蛋", "category": "snack", "source": "eat_out", "season": "all"}


@pytest.fixture(autouse=True)
def signed_in(sqlite_db):
    previous = app.dependency_overrides.get(auth.current_user_uid)
    app.dependency_overrides[auth.current_user_uid] = lambda: UID
    yield
    if previous is None:
        app.dependency_overrides.pop(auth.current_user_uid, None)
    else:
        app.dependency_overrides[auth.current_user_uid] = previous


# --- meals ---

def test_creating_a_meal(sqlite_db):
    resp = client.post("/meals", json=CHICKEN)

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "氣炸鍋雞胸"
    assert body["method"] == "air_fryer"
    assert body["note"] is None
    assert body["id"] == meals.list_meals(UID)[0].id


@pytest.mark.parametrize(
    "bad",
    [
        {**CHICKEN, "name": "  "},
        {**CHICKEN, "category": "lunch"},
        {**CHICKEN, "source": "delivery"},
        {**CHICKEN, "season": "spring"},
        {**CHICKEN, "method": "oven"},
        {**CHICKEN, "method": None},
    ],
)
def test_a_rule_break_answers_422(sqlite_db, bad):
    assert client.post("/meals", json=bad).status_code == 422
    assert meals.list_meals(UID) == []


def test_a_missing_field_answers_422(sqlite_db):
    assert client.post("/meals", json={"name": "只有名字"}).status_code == 422


def test_listing_passes_the_filters_through(sqlite_db):
    client.post("/meals", json=CHICKEN)
    client.post("/meals", json=EGG)

    everything = client.get("/meals").json()["meals"]
    only_out = client.get("/meals", params={"source": "eat_out"}).json()["meals"]
    by_word = client.get("/meals", params={"q": "雞"}).json()["meals"]

    assert [m["name"] for m in everything] == ["7-11 茶葉蛋", "氣炸鍋雞胸"]
    assert [m["name"] for m in only_out] == ["7-11 茶葉蛋"]
    assert [m["name"] for m in by_word] == ["氣炸鍋雞胸"]


def test_updating_replaces_the_whole_meal(sqlite_db):
    meal_id = client.post("/meals", json=CHICKEN).json()["id"]

    resp = client.patch(f"/meals/{meal_id}", json=EGG)

    assert resp.status_code == 200
    assert resp.json()["source"] == "eat_out"
    assert resp.json()["method"] is None
    assert meals.get_meal(UID, meal_id).name == "7-11 茶葉蛋"


def test_a_bad_update_answers_422_and_changes_nothing(sqlite_db):
    meal_id = client.post("/meals", json=CHICKEN).json()["id"]

    assert client.patch(f"/meals/{meal_id}", json={**EGG, "name": ""}).status_code == 422
    assert meals.get_meal(UID, meal_id).name == "氣炸鍋雞胸"


def test_deleting_a_meal(sqlite_db):
    meal_id = client.post("/meals", json=CHICKEN).json()["id"]

    assert client.delete(f"/meals/{meal_id}").json() == {"deleted": meal_id}
    assert meals.list_meals(UID) == []


def test_someone_elses_meal_is_404_for_update_and_delete(sqlite_db):
    theirs = meals.create_meal("someone-else", **CHICKEN)

    assert client.patch(f"/meals/{theirs.id}", json=EGG).status_code == 404
    assert client.delete(f"/meals/{theirs.id}").status_code == 404
    assert meals.get_meal("someone-else", theirs.id).name == "氣炸鍋雞胸"


# --- notes ---

def test_notes_path_is_not_read_as_a_meal_id(sqlite_db):
    """/meals/notes must reach the notes, not 422 on a non-integer meal id."""
    assert client.get("/meals/notes").status_code == 200
    assert client.get("/meals/notes").json() == {"notes": []}


def test_adding_and_listing_notes(sqlite_db):
    resp = client.post("/meals/notes", json={"text": "  吃油的飽足感很久 "})

    assert resp.status_code == 201
    assert resp.json()["text"] == "吃油的飽足感很久"
    assert [n["text"] for n in client.get("/meals/notes").json()["notes"]] == [
        "吃油的飽足感很久"
    ]


def test_a_blank_note_answers_422(sqlite_db):
    assert client.post("/meals/notes", json={"text": "   "}).status_code == 422
    assert meal_notes.list_notes(UID) == []


def test_deleting_a_note_and_someone_elses(sqlite_db):
    mine = client.post("/meals/notes", json={"text": "mine"}).json()["id"]
    theirs = meal_notes.add_note("someone-else", "theirs")

    assert client.delete(f"/meals/notes/{mine}").json() == {"deleted": mine}
    assert client.delete(f"/meals/notes/{theirs.id}").status_code == 404
    assert len(meal_notes.list_notes("someone-else")) == 1


def test_everything_needs_a_sign_in(sqlite_db):
    app.dependency_overrides.pop(auth.current_user_uid, None)
    for method, path in [
        ("get", "/meals"),
        ("post", "/meals"),
        ("get", "/meals/notes"),
        ("post", "/meals/notes"),
    ]:
        assert getattr(client, method)(path).status_code == 401, path
