"""Meals route tests — the HTTP glue over the service.

The rules themselves are tested against the service; here it's the status
codes, the shape of what comes back, and that /api/meals/notes is not mistaken
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
    resp = client.post("/api/meals", json=CHICKEN)

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "氣炸鍋雞胸"
    assert body["categories"] == ["meal"]
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
    assert client.post("/api/meals", json=bad).status_code == 422
    assert meals.list_meals(UID) == []


def test_a_rating_comes_back_and_a_bad_one_is_422(sqlite_db):
    created = client.post("/api/meals", json={**CHICKEN, "rating": 7}).json()
    assert created["rating"] == 7
    assert client.post("/api/meals", json=CHICKEN).json()["rating"] is None
    for bad in (0, 11, "eight", "8", 8.0, 7.5, True):
        assert client.post("/api/meals", json={**CHICKEN, "rating": bad}).status_code == 422, bad


def test_the_shop_comes_back_and_near_sorts(sqlite_db):
    shop = {"place_id": "x", "place_name": "石二鍋", "address": "信義區", "phone": "02",
            "lat": 25.0350, "lng": 121.5650, "maps_url": "https://maps.google.com/?cid=1"}
    client.post("/api/meals", json={**EGG, "name": "近的", **shop})
    client.post("/api/meals", json=CHICKEN)

    plain = client.get("/api/meals").json()["meals"]
    assert plain[0]["place"] is None and plain[0]["distance_m"] is None
    assert plain[1]["place"]["place_name"] == "石二鍋"

    near = client.get("/api/meals", params={"near": "25.0339,121.5645"}).json()["meals"]
    assert near[0]["name"] == "近的"
    assert 0 < near[0]["distance_m"] < 200
    assert near[1]["distance_m"] is None


def test_a_bad_near_is_422(sqlite_db):
    for bad in ("taipei", "25.0", "91,0", "25,181"):
        assert client.get("/api/meals", params={"near": bad}).status_code == 422, bad


def test_the_video_link_comes_back_and_a_bad_one_is_422(sqlite_db):
    made = client.post("/api/meals", json={**CHICKEN, "video_url": "https://youtu.be/x"}).json()
    assert made["video_url"] == "https://youtu.be/x"
    assert client.post("/api/meals", json=CHICKEN).json()["video_url"] is None
    assert client.post("/api/meals", json={**CHICKEN, "video_url": "youtu.be/x"}).status_code == 422


def test_proteins_go_in_and_out_as_a_list(sqlite_db):
    made = client.post("/api/meals", json={**EGG, "name": "牛肉火鍋", "proteins": ["seafood", "beef"]}).json()
    assert made["proteins"] == ["beef", "seafood"]
    assert client.post("/api/meals", json=CHICKEN).json()["proteins"] == []
    assert client.post("/api/meals", json={**CHICKEN, "proteins": ["lamb"]}).status_code == 422
    assert [m["name"] for m in client.get("/api/meals", params={"protein": "beef"}).json()["meals"]] == ["牛肉火鍋"]


def test_price_goes_in_and_out_and_filters(sqlite_db):
    assert client.post("/api/meals", json={**EGG, "name": "貴的", "price": 3}).json()["price"] == 3
    assert client.post("/api/meals", json=EGG).json()["price"] is None
    for bad in (0, 4, "2", 2.0):
        assert client.post("/api/meals", json={**EGG, "price": bad}).status_code == 422, bad
    assert [m["name"] for m in client.get("/api/meals", params={"price": 3}).json()["meals"]] == ["貴的"]
    assert client.get("/api/meals", params={"price": 9}).status_code == 422


def test_kinds_and_the_kind_filter(sqlite_db):
    client.post("/api/meals", json={**EGG, "name": "石二鍋", "kind": "火鍋"})
    client.post("/api/meals", json={**EGG, "name": "涮乃葉", "kind": "火鍋"})
    client.post("/api/meals", json={**CHICKEN, "kind": " 自煮 "})

    assert client.get("/api/meals/kinds").json() == {
        "kinds": [{"kind": "火鍋", "count": 2}, {"kind": "自煮", "count": 1}]
    }
    assert client.get("/api/meals/kinds", params={"source": "eat_out"}).json() == {
        "kinds": [{"kind": "火鍋", "count": 2}]
    }
    hotpot = client.get("/api/meals", params={"kind": "火鍋"}).json()["meals"]
    assert [m["name"] for m in hotpot] == ["涮乃葉", "石二鍋"]
    assert hotpot[0]["kind"] == "火鍋"


def test_categories_go_in_and_out_as_a_list(sqlite_db):
    made = client.post("/api/meals", json={**EGG, "category": None, "categories": ["meal", "breakfast"]}).json()
    assert made["categories"] == ["breakfast", "meal"]
    assert client.post("/api/meals", json={**EGG, "category": None, "categories": []}).status_code == 422
    assert [m["name"] for m in client.get("/api/meals", params={"category": "breakfast"}).json()["meals"]] == ["7-11 茶葉蛋"]


def test_a_missing_field_answers_422(sqlite_db):
    assert client.post("/api/meals", json={"name": "只有名字"}).status_code == 422


def test_listing_passes_the_filters_through(sqlite_db):
    client.post("/api/meals", json=CHICKEN)
    client.post("/api/meals", json=EGG)

    everything = client.get("/api/meals").json()["meals"]
    only_out = client.get("/api/meals", params={"source": "eat_out"}).json()["meals"]
    by_word = client.get("/api/meals", params={"q": "雞"}).json()["meals"]

    assert [m["name"] for m in everything] == ["7-11 茶葉蛋", "氣炸鍋雞胸"]
    assert [m["name"] for m in only_out] == ["7-11 茶葉蛋"]
    assert [m["name"] for m in by_word] == ["氣炸鍋雞胸"]


def test_updating_replaces_the_whole_meal(sqlite_db):
    meal_id = client.post("/api/meals", json=CHICKEN).json()["id"]

    resp = client.patch(f"/api/meals/{meal_id}", json=EGG)

    assert resp.status_code == 200
    assert resp.json()["source"] == "eat_out"
    assert resp.json()["method"] is None
    assert meals.get_meal(UID, meal_id).name == "7-11 茶葉蛋"


def test_a_bad_update_answers_422_and_changes_nothing(sqlite_db):
    meal_id = client.post("/api/meals", json=CHICKEN).json()["id"]

    assert client.patch(f"/api/meals/{meal_id}", json={**EGG, "name": ""}).status_code == 422
    assert meals.get_meal(UID, meal_id).name == "氣炸鍋雞胸"


def test_deleting_a_meal(sqlite_db):
    meal_id = client.post("/api/meals", json=CHICKEN).json()["id"]

    assert client.delete(f"/api/meals/{meal_id}").json() == {"deleted": meal_id}
    assert meals.list_meals(UID) == []


def test_someone_elses_meal_is_404_for_update_and_delete(sqlite_db):
    theirs = meals.create_meal("someone-else", **CHICKEN)

    assert client.patch(f"/api/meals/{theirs.id}", json=EGG).status_code == 404
    assert client.delete(f"/api/meals/{theirs.id}").status_code == 404
    assert meals.get_meal("someone-else", theirs.id).name == "氣炸鍋雞胸"


# --- notes ---

def test_notes_path_is_not_read_as_a_meal_id(sqlite_db):
    """/api/meals/notes must reach the notes. There is no GET /meals/{id} yet, so
    today this cannot fail; it is here so adding one can't quietly break it."""
    assert client.get("/api/meals/notes").status_code == 200
    assert client.get("/api/meals/notes").json() == {"notes": []}


def test_adding_and_listing_notes(sqlite_db):
    resp = client.post("/api/meals/notes", json={"text": "  吃油的飽足感很久 "})

    assert resp.status_code == 201
    assert resp.json()["text"] == "吃油的飽足感很久"
    assert [n["text"] for n in client.get("/api/meals/notes").json()["notes"]] == [
        "吃油的飽足感很久"
    ]


def test_a_blank_note_answers_422(sqlite_db):
    assert client.post("/api/meals/notes", json={"text": "   "}).status_code == 422
    assert meal_notes.list_notes(UID) == []


def test_deleting_a_note_and_someone_elses(sqlite_db):
    mine = client.post("/api/meals/notes", json={"text": "mine"}).json()["id"]
    theirs = meal_notes.add_note("someone-else", "theirs")

    assert client.delete(f"/api/meals/notes/{mine}").json() == {"deleted": mine}
    assert client.delete(f"/api/meals/notes/{theirs.id}").status_code == 404
    assert len(meal_notes.list_notes("someone-else")) == 1


def test_everything_needs_a_sign_in(sqlite_db):
    app.dependency_overrides.pop(auth.current_user_uid, None)
    for method, path in [
        ("get", "/api/meals"),
        ("post", "/api/meals"),
        ("get", "/api/meals/notes"),
        ("post", "/api/meals/notes"),
    ]:
        assert getattr(client, method)(path).status_code == 401, path
