"""A shared Google Maps link → the shop behind it.

A phone shares "https://maps.app.goo.gl/…"; following it lands on a
maps.google.com URL whose `q=` is "address + name" (desktop links carry
"/place/<name>/" instead). That text goes to Places text search, which
answers with the place — id, name, address, phone, coordinates, the Maps
link — and its primary type, which makes a decent first "kind".
"""
import re
from urllib.parse import parse_qs, unquote, urlparse

import httpx

from app.core import config

PLACES = "https://places.googleapis.com/v1"
FIELDS = (
    "places.id,places.displayName,places.formattedAddress,"
    "places.nationalPhoneNumber,places.location,places.googleMapsUri,"
    "places.primaryTypeDisplayName,places.priceLevel"
)

# Google's four levels onto our three: $ / $$ / $$$.
PRICE_LEVELS = {
    "PRICE_LEVEL_INEXPENSIVE": 1,
    "PRICE_LEVEL_MODERATE": 2,
    "PRICE_LEVEL_EXPENSIVE": 3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 3,
}


class LinkError(ValueError):
    """The link could not be turned into a place; the message says why."""


def follow(url: str) -> str:
    """The final URL a share link lands on. A non-Google link stays as is."""
    if not re.match(r"https?://", url or ""):
        raise LinkError("Not a web address")
    try:
        r = httpx.get(
            url, follow_redirects=True, timeout=10.0,
            headers={"User-Agent": "Mozilla/5.0"},
        )
    except httpx.HTTPError as e:
        raise LinkError(f"Could not open the link: {e.__class__.__name__}")
    return str(r.url)


def query_text(url: str) -> str:
    """What to search Places for, read out of a Google Maps URL."""
    parsed = urlparse(url)
    if "google" not in parsed.netloc:
        raise LinkError("Not a Google Maps link")
    q = parse_qs(parsed.query).get("q", [""])[0].strip()
    if q:
        return q
    m = re.search(r"/place/([^/@]+)", parsed.path)
    if m:
        return unquote(m.group(1)).replace("+", " ").strip()
    raise LinkError("This link names no place")


def search(text: str) -> dict:
    """Places text search → the seven shop fields plus a kind hint."""
    if not config.PLACES_SERVER_KEY:
        raise LinkError("No Places key on the server")
    r = httpx.post(
        f"{PLACES}/places:searchText",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": config.PLACES_SERVER_KEY,
            "X-Goog-FieldMask": FIELDS,
        },
        json={"textQuery": text, "languageCode": "zh-TW", "regionCode": "TW", "pageSize": 1},
        timeout=10.0,
    )
    if r.status_code != 200:
        raise LinkError(f"Places answered {r.status_code}")
    places = r.json().get("places") or []
    if not places:
        raise LinkError("Google found no place for that link")
    return to_fields(places[0])


def to_fields(place: dict) -> dict:
    loc = place.get("location") or {}
    return {
        "place_id": place.get("id"),
        "place_name": (place.get("displayName") or {}).get("text"),
        "address": place.get("formattedAddress"),
        "phone": place.get("nationalPhoneNumber"),
        "lat": loc.get("latitude"),
        "lng": loc.get("longitude"),
        "maps_url": place.get("googleMapsUri"),
        "kind_hint": (place.get("primaryTypeDisplayName") or {}).get("text"),
        "price_hint": PRICE_LEVELS.get(place.get("priceLevel")),
    }


def resolve(url: str) -> dict:
    """Share link in, shop out. Raises LinkError with a plain reason."""
    return search(query_text(follow((url or "").strip())))
