"""A shared Google Maps link becomes a shop. Google itself is faked; what is
checked is the reading of the link and the shape handed back."""
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import config
from app.core import security as auth
from app.main import app
from app.services import places
from app.services.places import LinkError

client = TestClient(app)

SHORT = "https://maps.app.goo.gl/WSFK2Ks6UXYF6txq5?g_st=ic"
LANDED = (
    "https://maps.google.com/?q=106%E8%87%BA%E5%8C%97%E5%B8%82Hala+Chicken+%E5%A4%A7%E5%AE%89"
    "&ftid=0x3442abc680e61327:0xc7b67d43128871e7&entry=gps"
)
GOOGLE = {
    "places": [{
        "id": "ChIJJxPmgMarQjQR53GIEkN9tsc",
        "displayName": {"text": "Hala Chicken 大安創始店", "languageCode": "zh"},
        "formattedAddress": "106臺北市大安區華聲里延吉街131巷4號",
        "nationalPhoneNumber": "02 8772 6300",
        "location": {"latitude": 25.0425592, "longitude": 121.5545888},
        "googleMapsUri": "https://maps.google.com/?cid=14390827386336211431",
        "primaryTypeDisplayName": {"text": "速食餐廳", "languageCode": "zh-TW"},
        "priceLevel": "PRICE_LEVEL_INEXPENSIVE",
    }]
}


def test_the_search_text_is_the_q_of_a_phone_link():
    assert places.query_text(LANDED) == "106臺北市Hala Chicken 大安"


def test_the_search_text_is_the_place_of_a_desktop_link():
    url = "https://www.google.com/maps/place/Hala+Chicken+%E5%A4%A7%E5%AE%89/@25.04,121.55,17z/data=!3m1"
    assert places.query_text(url) == "Hala Chicken 大安"


def test_a_link_that_is_not_google_maps_is_refused():
    with pytest.raises(LinkError):
        places.query_text("https://example.com/?q=x")
    with pytest.raises(LinkError):
        places.query_text("https://maps.google.com/")
    with pytest.raises(LinkError):
        places.follow("not a link")


def test_googles_answer_becomes_the_seven_fields_and_a_kind():
    fields = places.to_fields(GOOGLE["places"][0])
    assert fields == {
        "place_id": "ChIJJxPmgMarQjQR53GIEkN9tsc",
        "place_name": "Hala Chicken 大安創始店",
        "address": "106臺北市大安區華聲里延吉街131巷4號",
        "phone": "02 8772 6300",
        "lat": 25.0425592,
        "lng": 121.5545888,
        "maps_url": "https://maps.google.com/?cid=14390827386336211431",
        "kind_hint": "速食餐廳",
        "price_hint": 1,
    }
    assert places.to_fields({"id": "x"})["phone"] is None
    assert places.to_fields({"id": "x"})["price_hint"] is None
    assert places.to_fields({"priceLevel": "PRICE_LEVEL_VERY_EXPENSIVE"})["price_hint"] == 3


def _fake_google(monkeypatch, *, landed=LANDED, answer=GOOGLE, status=200, seen=None):
    def fake_get(url, **kw):
        return httpx.Response(200, request=httpx.Request("GET", landed))

    def fake_post(url, json=None, **kw):
        if seen is not None:
            seen.append(json["textQuery"])
        return httpx.Response(status, json=answer, request=httpx.Request("POST", url))

    monkeypatch.setattr(places.httpx, "get", fake_get)
    monkeypatch.setattr(places.httpx, "post", fake_post)
    monkeypatch.setattr(config, "PLACES_SERVER_KEY", "test-key")


def test_resolve_follows_the_link_and_searches_its_text(monkeypatch):
    seen = []
    _fake_google(monkeypatch, seen=seen)

    fields = places.resolve(SHORT)

    assert seen == ["106臺北市Hala Chicken 大安"]
    assert fields["place_name"] == "Hala Chicken 大安創始店"
    assert fields["kind_hint"] == "速食餐廳"


def test_no_place_and_no_key_are_plain_errors(monkeypatch):
    _fake_google(monkeypatch, answer={"places": []})
    with pytest.raises(LinkError):
        places.resolve(SHORT)
    _fake_google(monkeypatch, status=403)
    with pytest.raises(LinkError):
        places.resolve(SHORT)
    monkeypatch.setattr(config, "PLACES_SERVER_KEY", "")
    with pytest.raises(LinkError):
        places.search("x")


def test_the_route_returns_the_shop_or_422(monkeypatch, sqlite_db):
    app.dependency_overrides[auth.current_user_uid] = lambda: "u-link"
    try:
        _fake_google(monkeypatch)
        ok = client.post("/api/meals/resolve-link", json={"url": SHORT})
        assert ok.status_code == 200
        assert ok.json()["place_name"] == "Hala Chicken 大安創始店"

        _fake_google(monkeypatch, answer={"places": []})
        bad = client.post("/api/meals/resolve-link", json={"url": SHORT})
        assert bad.status_code == 422
        assert "no place" in bad.json()["detail"]
    finally:
        app.dependency_overrides.pop(auth.current_user_uid, None)


def test_the_route_needs_a_sign_in(sqlite_db):
    assert client.post("/api/meals/resolve-link", json={"url": SHORT}).status_code == 401
