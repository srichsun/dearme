"""FastAPI entrypoint — assembly only.

This file wires the app together and nothing else: middleware, the API routes
(see app/api/), and the built frontend. All the actual work lives in
app/services/; the endpoints themselves live in app/api/routes/.
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core import config, db

log = logging.getLogger(__name__)

app = FastAPI(title="Dear Myself")


@app.on_event("startup")
def _check_settings() -> None:
    """Refuse to boot on a misconfigured deploy, rather than serving a 500 to
    the first person who talks to the coach.

    Cloud Run's health check fails, the release is rolled back automatically,
    and the reason is the first line in the logs. Checked here rather than at
    import time so tests can import the modules without any real keys.
    """
    missing = config.missing_required_settings()
    if missing:
        raise RuntimeError("Cannot start — bad configuration: " + "; ".join(missing))


@app.on_event("startup")
def _ensure_tables() -> None:
    """Run any pending migrations on boot, so a fresh deploy (e.g. Cloud Run
    pointed at an empty Cloud SQL) works with no manual step.

    Best-effort on purpose: a transient DB hiccup shouldn't stop the app from
    serving /health, which is what you need to diagnose it. The failure is
    logged rather than swallowed — a schema left behind is worth knowing about.
    (pgvector's own tables are created by LangChain on first use.)
    """
    try:
        db.run_migrations()
    except Exception:
        log.exception("Database migration failed — schema may be out of date")


@app.middleware("http")
async def _cache_headers(request, call_next):
    """Tell browsers how long to keep the frontend.

    Without this the pages went out as plain "private", and a phone — an
    iPhone with the site on its home screen especially — decided for itself
    how long to keep index.html, so a deploy could sit unseen for days.
    HTML: always check back (ETag makes that a cheap 304). Built assets carry
    a content hash in their name, so they can be kept for a year.
    """
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if request.url.path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif content_type.startswith("text/html"):
        response.headers["Cache-Control"] = "no-cache"
    return response


# Allow the local React dev server (Vite) to call this API from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

# The built frontend's entry page. StaticFiles(html=True) below only answers
# index.html for "/" itself, so a second app at another path needs its own
# route — otherwise the deployed URL is a 404 while the Vite dev server (which
# has its own fallback) makes it look fine.
_INDEX = Path("frontend/dist/index.html")


@app.get("/meals", include_in_schema=False)
def meals_page():
    """The "what can I eat" app. Its API lives under /api/meals so the page
    and the JSON never fight over one path."""
    if not _INDEX.is_file():
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(_INDEX)


# Serve the built React frontend (if present) so the whole app lives at one URL.
# Mounted last, at "/", so the API routes above always take precedence; only
# unmatched paths (the SPA and its assets) fall through to the static files.
# Absent in local dev, where the frontend runs on its own Vite server.
if os.path.isdir("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="web")
