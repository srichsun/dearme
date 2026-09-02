"""The shopping list: sections, ticks that stay, nothing across accounts."""
import pytest
from fastapi.testclient import TestClient

from app.core import security as auth
from app.main import app
from app.services import shopping
from app.services.shopping import ShoppingError

client = TestClient(app)
UID = "u-shop"


def test_items_come_back_by_section_then_order(sqlite_db):
    shopping.add_item("u1", "fruit", "香蕉")
    shopping.add_item("u1", "protein", " 雞胸 ")
    shopping.add_item("u1", "protein", "蛋")

    assert [(i["section"], i["text"], i["done"]) for i in shopping.list_items("u1")] == [
        ("protein", "雞胸", False), ("protein", "蛋", False), ("fruit", "香蕉", False),
    ]


def test_blank_or_unknown_section_is_refused(sqlite_db):
    with pytest.raises(ShoppingError):
        shopping.add_item("u1", "protein", "  ")
    with pytest.raises(ShoppingError):
        shopping.add_item("u1", "toys", "x")
    assert shopping.list_items("u1") == []


def test_tick_rename_delete_and_clear(sqlite_db):
    a = shopping.add_item("u1", "carbs", "地瓜")
    b = shopping.add_item("u1", "drinks", "無糖豆漿")

    assert shopping.update_item("u1", a["id"], done=True)["done"] is True
    assert shopping.update_item("u1", b["id"], text="無糖豆漿 x2")["text"] == "無糖豆漿 x2"
    with pytest.raises(ShoppingError):
        shopping.update_item("u1", b["id"], text=" ")
    assert shopping.clear_done("u1") == 1
    assert [i["text"] for i in shopping.list_items("u1")] == ["無糖豆漿 x2"]
    assert shopping.delete_item("u1", b["id"]) is True
    assert shopping.list_items("u1") == []


def test_nothing_crosses_accounts(sqlite_db):
    theirs = shopping.add_item("u2", "snacks", "theirs")
    shopping.update_item("u2", theirs["id"], done=True)

    assert shopping.update_item("u1", theirs["id"], done=False) is None
    assert shopping.delete_item("u1", theirs["id"]) is False
    assert shopping.clear_done("u1") == 0
    assert shopping.list_items("u2")[0]["done"] is True


@pytest.fixture
def signed_in(sqlite_db):
    app.dependency_overrides[auth.current_user_uid] = lambda: UID
    yield
    app.dependency_overrides.pop(auth.current_user_uid, None)


def test_the_routes(signed_in):
    made = client.post("/api/shopping", json={"section": "fruit", "text": "蘋果"})
    assert made.status_code == 201
    iid = made.json()["id"]
    assert client.post("/api/shopping", json={"section": "toys", "text": "x"}).status_code == 422
    assert client.patch(f"/api/shopping/{iid}", json={"done": True}).json()["done"] is True
    assert client.get("/api/shopping").json()["items"][0]["text"] == "蘋果"
    assert client.post("/api/shopping/clear-done").json() == {"cleared": 1}
    assert client.patch(f"/api/shopping/{iid}", json={"done": False}).status_code == 404
    assert client.delete(f"/api/shopping/{iid}").status_code == 404


def test_shopping_needs_a_sign_in(sqlite_db):
    assert client.get("/api/shopping").status_code == 401
