"""The food log: a day's entries and totals, targets, the report; the routes."""
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core import clock
from app.core import security as auth
from app.main import app
from app.services import blobs, food, food_estimate
from app.services.food import FoodError

client = TestClient(app)
UID = "u-food"
RICE = dict(text="一碗白飯", kcal=280, protein=5, carbs=62, fat=0.5)


def test_add_list_totals_and_edit(sqlite_db):
    a = food.add_log("u1", **RICE, source="tfnd", items=[{"name": "白飯"}])
    b = food.add_log("u1", text="雞胸", kcal=250, protein=45, carbs=0, fat=5)

    logs = food.day_logs("u1", clock.today())
    assert [x["text"] for x in logs] == ["一碗白飯", "雞胸"]
    assert food.totals(logs) == {"kcal": 530, "protein": 50, "carbs": 62, "fat": 5.5}
    assert a["items"] == [{"name": "白飯"}]

    edited = food.update_log("u1", b["id"], kcal=300, text=" 雞胸 200g ")
    assert edited["kcal"] == 300 and edited["text"] == "雞胸 200g" and edited["protein"] == 45
    assert food.delete_log("u1", a["id"]) is True
    assert len(food.day_logs("u1", clock.today())) == 1


def test_bad_input_is_refused(sqlite_db):
    with pytest.raises(FoodError):
        food.add_log("u1", **{**RICE, "text": " "})
    with pytest.raises(FoodError):
        food.add_log("u1", **{**RICE, "kcal": -1})
    with pytest.raises(FoodError):
        food.add_log("u1", **RICE, kind="snack")
    with pytest.raises(FoodError):
        food.add_log("u1", **RICE, source="guess")
    assert food.day_logs("u1", clock.today()) == []


def test_editing_a_label_entry_by_hand_drops_the_label_claim(sqlite_db):
    a = food.add_log("u1", **RICE, kind="label", source="label")
    assert food.update_log("u1", a["id"], kcal=300)["source"] == "model"


def test_saving_a_log_remembers_label_and_brand_items(sqlite_db):
    from app.services import food_items

    food.add_log("u1", text="早餐", kcal=690, protein=28, carbs=52, fat=31, source="mixed", items=[
        {"name": "無敵豬肉滿福堡加蛋", "grams": 190, "kcal": 550, "protein": 25, "carbs": 47, "fat": 30, "source": "brand"},
        {"name": "無糖豆漿", "grams": 400, "kcal": 140, "protein": 14, "carbs": 6, "fat": 7, "source": "label"},
        {"name": "黑咖啡", "grams": 300, "kcal": 5, "protein": 0, "carbs": 0, "fat": 0, "source": "model"},
    ])
    saved = food_items.list_items("u1")
    assert [i["name"] for i in saved] == ["無敵豬肉滿福堡加蛋", "無糖豆漿"]
    burger = next(i for i in saved if i["name"].startswith("無敵"))
    assert burger["serving_g"] == 190 and round(burger["kcal"] * 1.9) == 550
    assert food_items.match("u1", "早上一個無敵豬肉滿福堡加蛋")["name"] == "無敵豬肉滿福堡加蛋"
    assert food_items.per_grams(burger, 190)["kcal"] == 550.0
    assert food_items.forget("u1", burger["id"]) is True
    assert food_items.forget("u2", saved[1]["id"]) is False


def test_targets_default_then_set(sqlite_db):
    assert food.get_targets("u1") == food.DEFAULT_TARGET
    assert food.set_targets("u1", {"kcal": 2200, "protein": 170, "carbs": 220, "fat": 70})["kcal"] == 2200
    assert food.get_targets("u1")["protein"] == 170
    for bad in ({"kcal": 0, "protein": 1, "carbs": 1, "fat": 1}, {"kcal": 2000.5, "protein": 1, "carbs": 1, "fat": 1}):
        with pytest.raises(FoodError):
            food.set_targets("u1", bad)


def test_the_report_has_every_day_and_averages_only_logged_ones(sqlite_db):
    yesterday = clock.today() - timedelta(days=1)
    food.add_log("u1", **RICE, day=yesterday)
    food.add_log("u1", **RICE, day=yesterday)
    food.add_log("u1", text="x", kcal=2500, protein=1, carbs=1, fat=1)

    r = food.report("u1", 7)
    assert len(r["days"]) == 7 and r["days"][-1]["day"] == clock.today().isoformat()
    assert r["days"][-1]["kcal"] == 2500 and r["days"][-2]["kcal"] == 560
    assert r["days"][0]["logged"] is False and r["days"][0]["kcal"] == 0
    assert r["logged_days"] == 2 and r["average"]["kcal"] == 1530
    assert r["on_target_days"] == 1  # 2500 vs the 2500 default


def test_nothing_crosses_accounts(sqlite_db):
    theirs = food.add_log("u2", **RICE)
    assert food.update_log("u1", theirs["id"], kcal=1) is None
    assert food.delete_log("u1", theirs["id"]) is False
    assert food.day_logs("u1", clock.today()) == []
    assert food.report("u1", 3)["logged_days"] == 0


# --- routes ---

@pytest.fixture
def signed_in(sqlite_db, monkeypatch):
    app.dependency_overrides[auth.current_user_uid] = lambda: UID

    class Fake:
        def invoke(self, msgs):
            return food_estimate._Estimate(
                items=[food_estimate._Item(name="水煮馬鈴薯", grams=200, kcal=160, protein=4, carbs=36, fat=0.4, table_name="馬鈴薯")],
                note="估的",
            )

    monkeypatch.setattr(food_estimate, "_estimator", lambda vision: Fake())
    monkeypatch.setattr(blobs, "upload", lambda prefix, data, ct, ext=".jpg": ("food/x.jpg", "https://bucket/food/x.jpg"))
    yield
    app.dependency_overrides.pop(auth.current_user_uid, None)


def test_estimate_then_save_then_see_the_day(signed_in):
    est = client.post("/api/food/estimate", data={"text": "水煮馬鈴薯 200g", "kind": "meal"})
    assert est.status_code == 200
    body = est.json()
    assert body["totals"]["kcal"] == 148 and body["items"][0]["source"] == "tfnd"
    assert body["photo_url"] is None

    with_photo = client.post(
        "/api/food/estimate",
        data={"text": "", "kind": "meal"},
        files={"photo": ("p.jpg", b"\xff\xd8\xff", "image/jpeg")},
    )
    assert with_photo.json()["photo_url"] == "https://bucket/food/x.jpg"

    saved = client.post("/api/food", json={
        "text": "水煮馬鈴薯 200g", **body["totals"], "items": body["items"], "source": body["source"],
    })
    assert saved.status_code == 201
    day = client.get("/api/food").json()
    assert day["totals"]["kcal"] == 148 and day["targets"]["kcal"] == 2500
    assert client.patch(f"/api/food/{saved.json()['id']}", json={"kcal": 160}).json()["kcal"] == 160
    assert client.get("/api/food/report", params={"days": 3}).json()["logged_days"] == 1
    assert client.delete(f"/api/food/{saved.json()['id']}").json()["deleted"] == saved.json()["id"]


def test_estimate_refuses_nothing_and_bad_kinds(signed_in):
    assert client.post("/api/food/estimate", data={"text": "  ", "kind": "meal"}).status_code == 422
    assert client.post("/api/food/estimate", data={"text": "x", "kind": "snack"}).status_code == 422
    assert client.get("/api/food", params={"day": "yesterday"}).status_code == 422


def test_my_items_routes(signed_in):
    from app.services import food_items

    it = food_items.remember(UID, "無糖豆漿", 400, {"kcal": 140, "protein": 14, "carbs": 6, "fat": 7}, "label")
    assert client.get("/api/food/items").json()["items"][0]["name"] == "無糖豆漿"
    assert client.delete(f"/api/food/items/{it['id']}").json() == {"deleted": it["id"]}
    assert client.delete(f"/api/food/items/{it['id']}").status_code == 404


def test_targets_routes(signed_in):
    assert client.put("/api/food/targets", json={"kcal": 2300, "protein": 170, "carbs": 230, "fat": 70}).json()["kcal"] == 2300
    assert client.get("/api/food/targets").json()["fat"] == 70
    assert client.put("/api/food/targets", json={"kcal": "2300", "protein": 1, "carbs": 1, "fat": 1}).status_code == 422


def test_food_needs_a_sign_in(sqlite_db):
    assert client.get("/api/food").status_code == 401
