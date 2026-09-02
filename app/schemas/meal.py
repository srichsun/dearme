"""Request shapes for the meals list and the eating notes.

Deliberately loose: the codes are checked by the service, which is where the
rules live, so the same message comes back whether the caller is HTTP or a
future planner.
"""
from pydantic import BaseModel, StrictInt


class MealWrite(BaseModel):
    """A whole meal, as the dialog sends it — for both create and update."""

    name: str
    category: str
    source: str
    season: str
    method: str | None = None
    recipe: str | None = None
    note: str | None = None
    # Strict: lax int would turn true into 1 and "8" into 8 before the
    # service could refuse them, and the rule says a whole number.
    rating: StrictInt | None = None
    kind: str | None = None
    video_url: str | None = None
    proteins: list[str] = []
    price: StrictInt | None = None
    # The shop, from Google Places; only kept for eating out.
    place_id: str | None = None
    place_name: str | None = None
    address: str | None = None
    phone: str | None = None
    lat: float | None = None
    lng: float | None = None
    maps_url: str | None = None


class NoteWrite(BaseModel):
    text: str


class LinkRequest(BaseModel):
    """A shared Google Maps link."""

    url: str


class SearchRequest(BaseModel):
    """A sentence about what to eat, to be turned into filters. `near` is
    "lat,lng" — where the person is, so the answer can be sorted by distance."""

    text: str
    near: str | None = None
