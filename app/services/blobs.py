"""Files in the public bucket: reward clips and food photos share it.
The client is built lazily so tests can swap the bucket out."""
import mimetypes
import secrets

from app.core import config


class BlobError(ValueError):
    pass


def bucket():
    if not config.REWARD_BUCKET:
        raise BlobError("No bucket configured on this server")
    from google.cloud import storage

    return storage.Client().bucket(config.REWARD_BUCKET)


def upload(prefix: str, data: bytes, content_type: str, default_ext: str = ".bin") -> tuple[str, str]:
    """Store bytes under a random name; return (object_name, public url)."""
    ext = mimetypes.guess_extension(content_type or "") or default_ext
    name = f"{prefix}/{secrets.token_urlsafe(12)}{ext}"
    blob = bucket().blob(name)
    blob.cache_control = "public, max-age=31536000, immutable"
    blob.upload_from_string(data, content_type=content_type)
    return name, f"https://storage.googleapis.com/{config.REWARD_BUCKET}/{name}"
