"""Reward clips: stored in the bucket (faked here), listed, picked, deleted."""
import io

import pytest
from fastapi.testclient import TestClient

from datetime import timedelta

from app.core import clock, config
from app.core import security as auth
from app.main import app
from app.services import rewards
from app.services.rewards import RewardError

client = TestClient(app)


class FakeBlob:
    def __init__(self, store, name):
        self.store, self.name, self.cache_control = store, name, None

    def upload_from_string(self, data, content_type):
        self.store[self.name] = (data, content_type, self.cache_control)

    def delete(self):
        self.store.pop(self.name, None)


class FakeBucket:
    def __init__(self):
        self.store = {}

    def blob(self, name):
        return FakeBlob(self.store, name)


@pytest.fixture
def bucket(monkeypatch):
    fake = FakeBucket()
    monkeypatch.setattr(config, "REWARD_BUCKET", "test-bucket")
    monkeypatch.setattr(rewards, "_bucket", lambda: fake)
    return fake


def test_a_clip_is_stored_under_a_random_name_and_listed(sqlite_db, bucket):
    v = rewards.add_video("user-1234", b"bytes", "video/mp4", "  加油 ")

    assert v["title"] == "加油"
    assert v["url"] is None  # not earned yet
    (name, (data, ctype, cache)), = bucket.store.items()
    assert name.startswith("user-123/") and name.endswith(".mp4")
    assert data == b"bytes" and ctype == "video/mp4" and "immutable" in cache
    listed = rewards.list_videos("user-1234")
    assert listed[0]["title"] == "加油"
    assert listed[0]["url"] is None  # locked: the URL is not handed out
    assert listed[0]["unlocked_on"] is None


def test_refuses_what_is_not_a_small_video(sqlite_db, bucket):
    for data, ctype in [(b"x", "image/png"), (b"", "video/mp4"), (b"x" * (rewards.MAX_BYTES + 1), "video/mp4")]:
        with pytest.raises(RewardError):
            rewards.add_video("u1", data, ctype, "t")
    assert bucket.store == {}


def test_no_bucket_means_no_uploads(sqlite_db, monkeypatch):
    monkeypatch.setattr(config, "REWARD_BUCKET", "")
    with pytest.raises(RewardError):
        rewards.add_video("u1", b"x", "video/mp4", "t")


def test_delete_takes_the_file_and_stays_in_one_account(sqlite_db, bucket):
    v = rewards.add_video("u1", b"bytes", "video/mp4", "t")
    theirs = rewards.add_video("u2", b"bytes", "video/mp4", "t")

    assert rewards.delete_video("u1", theirs["id"]) is False
    assert rewards.delete_video("u1", v["id"]) is True
    assert len(bucket.store) == 1
    assert rewards.status("u1")["video"] is None


# --- earning today's clip ---

from app.services import today as today_svc  # noqa: E402


def _list(uid, *texts):
    return [today_svc.add_habit(uid, t) for t in texts]


def test_todays_clip_is_fixed_for_the_day_and_locked_until_the_list_is_done(sqlite_db, bucket):
    a = rewards.add_video("u1", b"a", "video/mp4", "A")
    b = rewards.add_video("u1", b"b", "video/mp4", "B")
    h1, h2 = _list("u1", "重訓", "走路")

    first = rewards.status("u1")
    assert first["video"]["id"] in (a["id"], b["id"])
    assert first["video"]["url"] is None and first["unlocked"] is False
    assert (first["done"], first["total"]) == (0, 2)
    assert rewards.status("u1")["video"]["id"] == first["video"]["id"]  # same all day

    with pytest.raises(rewards.LockedError):
        rewards.unlock("u1")
    today_svc.set_done("u1", h1.id, True)
    with pytest.raises(rewards.LockedError):
        rewards.unlock("u1")
    today_svc.set_done("u1", h2.id, True)

    earned = rewards.unlock("u1")
    assert earned["id"] == first["video"]["id"] and earned["url"].startswith("https://")
    after = rewards.status("u1")
    assert after["unlocked"] is True and after["video"]["url"] == earned["url"]
    assert [v["unlocked_on"] is not None for v in rewards.list_videos("u1")].count(True) == 1


def test_unearned_clips_come_first_then_everything_takes_turns(sqlite_db, bucket, monkeypatch):
    a = rewards.add_video("u1", b"a", "video/mp4", "A")
    b = rewards.add_video("u1", b"b", "video/mp4", "B")
    (h,) = _list("u1", "重訓")
    today_svc.set_done("u1", h.id, True)
    first = rewards.unlock("u1")["id"]

    tomorrow = clock.today() + timedelta(days=1)
    monkeypatch.setattr(clock, "today", lambda: tomorrow)
    second = rewards.status("u1")["video"]["id"]
    assert {first, second} == {a["id"], b["id"]}  # the other one is next
    assert rewards.status("u1")["unlocked"] is False  # a new day, a new lock
    assert rewards.status("u1")["done"] == 0


def test_an_empty_list_earns_nothing(sqlite_db, bucket):
    rewards.add_video("u1", b"a", "video/mp4", "A")
    with pytest.raises(rewards.LockedError):
        rewards.unlock("u1")


def test_the_routes(sqlite_db, bucket):
    app.dependency_overrides[auth.current_user_uid] = lambda: "u-r"
    try:
        made = client.post(
            "/api/today/rewards",
            files={"video": ("clip.mp4", io.BytesIO(b"bytes"), "video/mp4")},
            data={"title": "加油"},
        )
        assert made.status_code == 201
        vid = made.json()["id"]
        assert client.get("/api/today/rewards").json()["videos"][0]["title"] == "加油"
        assert client.get("/api/today/rewards/today").json()["video"]["id"] == vid
        assert client.post("/api/today/rewards/unlock").status_code == 409  # nothing ticked
        (h,) = _list("u-r", "重訓")
        today_svc.set_done("u-r", h.id, True)
        assert client.post("/api/today/rewards/unlock").json()["id"] == vid
        bad = client.post("/api/today/rewards", files={"video": ("x.png", io.BytesIO(b"x"), "image/png")})
        assert bad.status_code == 422
        assert client.delete(f"/api/today/rewards/{vid}").json() == {"deleted": vid}
        assert client.get("/api/today/rewards/today").json()["video"] is None
        assert client.post("/api/today/rewards/unlock").status_code == 404
    finally:
        app.dependency_overrides.pop(auth.current_user_uid, None)
