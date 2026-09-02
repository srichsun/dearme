"""The clips that play when the day's list is all ticked.

The bytes go to a public-read bucket under a random name; the row keeps the
URL and the object name so a delete takes the file with it. The bucket
client is built lazily and swapped out in tests.
"""
import mimetypes
import random
import secrets

from sqlalchemy import select

from app.core import config, db
from app.models import RewardVideo

MAX_BYTES = 25 * 1024 * 1024


class RewardError(ValueError):
    pass


def _bucket():
    if not config.REWARD_BUCKET:
        raise RewardError("Uploads are not set up on this server")
    from google.cloud import storage

    return storage.Client().bucket(config.REWARD_BUCKET)


def _dict(v: RewardVideo) -> dict:
    return {"id": v.id, "title": v.title, "url": v.url}


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


def pick(user_id: str) -> dict | None:
    """One at random, or None when there is nothing to play."""
    rows = list_videos(user_id)
    return random.choice(rows) if rows else None
