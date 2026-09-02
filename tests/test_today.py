"""The today screen: a goal, a checklist that resets each day, nothing
reachable across accounts."""
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app.core import clock
from app.core import security as auth
from app.main import app
from app.services import today

client = TestClient(app)
UID = "u-today"


# --- goal ---

def test_goal_is_nothing_until_written_then_kept(sqlite_db):
    assert today.get_goal("u1") is None
    assert today.set_goal("u1", "  減到 72 公斤，睡飽  ") == "減到 72 公斤，睡飽"
    assert today.get_goal("u1") == "減到 72 公斤，睡飽"
    assert today.set_goal("u1", "改了") == "改了"
    assert today.get_goal("u1") == "改了"


def test_blank_goal_removes_it(sqlite_db):
    today.set_goal("u1", "有")
    assert today.set_goal("u1", "   ") is None
    assert today.get_goal("u1") is None


def test_goals_are_per_person(sqlite_db):
    today.set_goal("u1", "mine")
    today.set_goal("u2", "theirs")
    assert today.get_goal("u1") == "mine"


# --- habits ---

def test_habits_keep_their_order_and_start_undone(sqlite_db):
    today.add_habit("u1", "重訓")
    today.add_habit("u1", "  10 點關機 ")

    assert [(h["text"], h["done"]) for h in today.list_habits("u1")] == [
        ("重訓", False), ("10 點關機", False),
    ]


def test_blank_habits_are_not_kept(sqlite_db):
    assert today.add_habit("u1", "  ") is None
    assert today.list_habits("u1") == []


def test_rename_and_delete(sqlite_db):
    h = today.add_habit("u1", "重訓")
    assert today.rename_habit("u1", h.id, "重訓 45 分").text == "重訓 45 分"
    assert today.rename_habit("u1", h.id, "  ") is None
    assert today.delete_habit("u1", h.id) is True
    assert today.list_habits("u1") == []


def test_ticking_is_about_today_only(sqlite_db, monkeypatch):
    h = today.add_habit("u1", "重訓")

    assert today.set_done("u1", h.id, True) is True
    assert today.list_habits("u1")[0]["done"] is True
    assert today.set_done("u1", h.id, True) is True  # twice is still once
    assert today.set_done("u1", h.id, False) is False
    assert today.list_habits("u1")[0]["done"] is False

    today.set_done("u1", h.id, True)
    tomorrow = clock.today() + timedelta(days=1)
    monkeypatch.setattr(clock, "today", lambda: tomorrow)
    assert today.list_habits("u1")[0]["done"] is False  # a new day starts clean


def test_deleting_a_ticked_habit_takes_its_checks(sqlite_db):
    from sqlalchemy import func, select

    from app.core import db
    from app.models import HabitCheck

    h = today.add_habit("u1", "重訓")
    today.set_done("u1", h.id, True)
    today.delete_habit("u1", h.id)
    with db.get_session() as s:
        assert s.scalar(select(func.count()).select_from(HabitCheck)) == 0


def test_starter_fills_an_empty_list_once(sqlite_db):
    first = today.add_starter("u1")
    again = today.add_starter("u1")

    assert [h["text"] for h in first] == list(today.STARTER)
    assert len(again) == 4
    today.add_habit("u2", "自己的")
    assert [h["text"] for h in today.add_starter("u2")] == ["自己的"]


# --- one account never reaches another's ---

def test_someone_elses_habit_is_out_of_reach(sqlite_db):
    theirs = today.add_habit("u2", "theirs")

    assert today.rename_habit("u1", theirs.id, "hijack") is None
    assert today.set_done("u1", theirs.id, True) is None
    assert today.delete_habit("u1", theirs.id) is False
    assert today.list_habits("u1") == []
    assert today.list_habits("u2")[0]["text"] == "theirs"


# --- the routes ---

@pytest.fixture
def signed_in(sqlite_db):
    app.dependency_overrides[auth.current_user_uid] = lambda: UID
    yield
    app.dependency_overrides.pop(auth.current_user_uid, None)


def test_the_screen_in_one_get(signed_in):
    client.put("/api/today/goal", json={"text": "睡飽"})
    hid = client.post("/api/today/habits", json={"text": "重訓"}).json()["id"]
    client.post(f"/api/today/habits/{hid}/check")

    body = client.get("/api/today").json()

    assert body["goal"] == "睡飽"
    assert body["day"] == clock.today().isoformat()
    assert body["habits"] == [{"id": hid, "text": "重訓", "done": True}]

    assert client.delete(f"/api/today/habits/{hid}/check").json() == {"id": hid, "done": False}
    assert client.patch(f"/api/today/habits/{hid}", json={"text": "重訓 45"}).json()["text"] == "重訓 45"
    assert client.delete(f"/api/today/habits/{hid}").json() == {"deleted": hid}


def test_starter_route_and_blanks(signed_in):
    assert [h["text"] for h in client.post("/api/today/habits/starter").json()["habits"]] == list(today.STARTER)
    assert client.post("/api/today/habits", json={"text": " "}).status_code == 422
    assert client.patch("/api/today/habits/1", json={"text": " "}).status_code == 422


def test_someone_elses_habit_is_404(signed_in):
    theirs = today.add_habit("someone-else", "theirs")
    assert client.patch(f"/api/today/habits/{theirs.id}", json={"text": "x"}).status_code == 404
    assert client.post(f"/api/today/habits/{theirs.id}/check").status_code == 404
    assert client.delete(f"/api/today/habits/{theirs.id}").status_code == 404


def test_today_needs_a_sign_in(sqlite_db):
    assert client.get("/api/today").status_code == 401
