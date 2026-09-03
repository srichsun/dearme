"""The clips that play when the day's list is all ticked.

The bytes go to a public-read bucket under a random name; the row keeps the
URL and the object name so a delete takes the file with it. The bucket
client is built lazily and swapped out in tests.
"""
import mimetypes
import secrets

from sqlalchemy import select

from app.core import clock, config, db
from app.models import RewardVideo
from app.services import today

MAX_BYTES = 25 * 1024 * 1024


class RewardError(ValueError):
    pass


def _bucket():
    if not config.REWARD_BUCKET:
        raise RewardError("Uploads are not set up on this server")
    from google.cloud import storage

    return storage.Client().bucket(config.REWARD_BUCKET)


def _dict(v: RewardVideo) -> dict:
    """A locked clip keeps its URL to itself — the point is to earn it."""
    unlocked = v.unlocked_on is not None
    return {
        "id": v.id,
        "title": v.title,
        "url": v.url if unlocked else None,
        "unlocked_on": v.unlocked_on.isoformat() if unlocked else None,
    }


class LockedError(ValueError):
    """The list is not all ticked yet."""


def list_videos(user_id: str) -> list[dict]:
    if not user_id:
        return []
    with db.get_session() as s:
        rows = s.scalars(
            select(RewardVideo).where(RewardVideo.user_id == user_id).order_by(RewardVideo.id)
        )
        return [_dict(v) for v in rows]


def add_video(user_id: str, data: bytes, content_type: str, title: str) -> dict:
    """Store the clip and remember it. Refuses non-video, empty, or oversize."""
    if not (content_type or "").startswith("video/"):
        raise RewardError("Only video files")
    if not data:
        raise RewardError("The file is empty")
    if len(data) > MAX_BYTES:
        raise RewardError("Keep it under 25MB")
    ext = mimetypes.guess_extension(content_type) or ".mp4"
    name = f"{user_id[:8]}/{secrets.token_urlsafe(12)}{ext}"
    blob = _bucket().blob(name)
    blob.cache_control = "public, max-age=31536000, immutable"
    blob.upload_from_string(data, content_type=content_type)
    url = f"https://storage.googleapis.com/{config.REWARD_BUCKET}/{name}"
    with db.get_session() as s:
        v = RewardVideo(user_id=user_id, title=(title or "").strip() or "激勵", url=url, object_name=name)
        s.add(v)
        s.commit()
        return _dict(v)


def delete_video(user_id: str, video_id: int) -> bool:
    with db.get_session() as s:
        v = s.scalar(select(RewardVideo).where(RewardVideo.id == video_id, RewardVideo.user_id == user_id))
        if v is None:
            return False
        try:
            _bucket().blob(v.object_name).delete()
        except Exception:  # noqa: BLE001 — the row goes regardless; a stray file is cheap
            pass
        s.delete(v)
        s.commit()
        return True


def _rows(user_id: str) -> list[RewardVideo]:
    with db.get_session() as s:
        return list(
            s.scalars(select(RewardVideo).where(RewardVideo.user_id == user_id).order_by(RewardVideo.id))
        )


def todays_video(user_id: str) -> RewardVideo | None:
    """The one clip on offer today — fixed for the whole day, so the card
    shows the same locked thing all day. Never-unlocked clips go first, in
    turn by date; once every clip has been earned, all of them take turns."""
    rows = _rows(user_id)
    if not rows:
        return None
    day = clock.today()
    for r in rows:
        if r.unlocked_on == day:
            return r  # already earned today: keep showing that one
    fresh = [r for r in rows if r.unlocked_on is None] or rows
    return fresh[day.toordinal() % len(fresh)]


def status(user_id: str) -> dict:
    """What the today card shows: the clip (URL only if earned), and how
    far along the list is."""
    habits = today.list_habits(user_id)
    done = sum(1 for h in habits if h["done"])
    v = todays_video(user_id)
    earned = v is not None and v.unlocked_on == clock.today()
    return {
        "video": (
            {"id": v.id, "title": v.title, "url": v.url if earned else None} if v else None
        ),
        "unlocked": earned,
        "done": done,
        "total": len(habits),
    }


def unlock(user_id: str) -> dict:
    """Earn today's clip. The server checks the list itself: every habit
    ticked today, and at least one habit. LockedError otherwise."""
    habits = today.list_habits(user_id)
    if not habits or not all(h["done"] for h in habits):
        raise LockedError("Finish today's list first")
    v = todays_video(user_id)
    if v is None:
        raise RewardError("No clips yet")
    with db.get_session() as s:
        row = s.get(RewardVideo, v.id)
        if row.unlocked_on is None:
            row.unlocked_on = clock.today()
            s.commit()
    return {"id": v.id, "title": v.title, "url": v.url}
