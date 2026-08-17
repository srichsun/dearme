"""The rolling read of the person, built from their journal."""
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.services import profile
from app.api.deps import CurrentUid

router = APIRouter(tags=["profile"])

# Without these a streamed body can be held somewhere between here and the
# screen and arrive all at once: a proxy caching it, or a browser waiting to
# sniff the content type before it will show anything. They cost nothing when
# the path is already clean.
STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "X-Content-Type-Options": "nosniff",
    "X-Accel-Buffering": "no",
}



@router.get("/profile")
def read_profile(uid: CurrentUid):
    """The current reading, plus how far behind it has fallen."""
    return {
        "sections": profile.get_profile(uid),
        "entries_behind": profile.entries_behind(uid),
    }


@router.post("/profile/refresh")
def refresh_profile(uid: CurrentUid):
    """Rebuild the reading from the journal. Only ever runs when asked."""
    return {"sections": profile.refresh_profile(uid), "entries_behind": 0}


@router.post("/profile/refresh/stream")
def refresh_profile_stream(uid: CurrentUid):
    """The same rebuild, streamed as it is written.

    The reading runs to about a thousand words, so waiting for the whole thing
    reads as a hung page. The text arrives with `### section` headings in it;
    the screen splits on those as it goes, and the finished reading is stored
    once the stream ends.
    """
    return StreamingResponse(
        profile.stream_and_save(uid),
        media_type="text/plain; charset=utf-8",
        headers=STREAM_HEADERS,
    )
