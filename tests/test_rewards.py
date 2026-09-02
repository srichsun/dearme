"""Reward clips: stored in the bucket (faked here), listed, picked, deleted."""
import io

import pytest
from fastapi.testclient import TestClient

from app.core import config
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
    assert v["url"].startswith("https://storage.googleapis.com/test-bucket/user-123/")
    assert v["url"].endswith(".mp4")
    (name, (data, ctype, cache)), = bucket.store.items()
    assert data == b"bytes" and ctype == "video/mp4" and "immutable" in cache
    assert rewards.list_videos("user-1234") == [v]
    assert rewards.pick("user-1234") == v


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
    assert list(bucket.store) == [theirs["url"].split("test-bucket/")[1]]
    assert rewards.pick("u1") is None


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
        assert client.get("/api/today/rewards/pick").json()["video"]["id"] == vid
        bad = client.post("/api/today/rewards", files={"video": ("x.png", io.BytesIO(b"x"), "image/png")})
        assert bad.status_code == 422
        assert client.delete(f"/api/today/rewards/{vid}").json() == {"deleted": vid}
        assert client.get("/api/today/rewards/pick").json()["video"] is None
    finally:
        app.dependency_overrides.pop(auth.current_user_uid, None)
