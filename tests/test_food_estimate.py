"""Words or a photo → items → checked against the Taiwan table."""
from app.services import food_estimate as fe


def _est(*items, note=""):
    return fe._Estimate(items=[fe._Item(**i) for i in items], note=note)


def test_a_matched_item_takes_the_tables_numbers_and_says_so():
    est = _est({"name": "水煮馬鈴薯", "grams": 200, "kcal": 999, "protein": 99, "carbs": 99, "fat": 99, "table_name": "馬鈴薯"})
    out = fe.check(est, "meal")
    item = out["items"][0]
    assert item["source"] == "tfnd" and item["matched"] == "馬鈴薯"
    assert item["kcal"] == 148 and item["protein"] == 5.2  # 74 kcal / 2.6 g per 100 g × 2
    assert out["totals"]["kcal"] == 148 and out["source"] == "tfnd"


def test_an_unmatched_item_keeps_the_models_guess():
    est = _est({"name": "Hala Chicken 炸雞胸", "grams": 180, "kcal": 520, "protein": 42, "carbs": 30, "fat": 24, "table_name": "無此物xyz"})
    out = fe.check(est, "meal")
    assert out["items"][0]["source"] == "model" and out["items"][0]["kcal"] == 520
    assert out["source"] == "model"


def test_mixed_sources_add_up():
    est = _est(
        {"name": "白飯", "grams": 200, "kcal": 1, "protein": 1, "carbs": 1, "fat": 1, "table_name": "白飯"},
        {"name": "神秘醬", "grams": 30, "kcal": 90, "protein": 0, "carbs": 5, "fat": 8, "table_name": None},
        note="一碗飯",
    )
    out = fe.check(est, "meal")
    assert {i["source"] for i in out["items"]} == {"tfnd", "model"}
    assert out["source"] == "mixed" and out["note"] == "一碗飯"
    assert out["totals"]["kcal"] == sum(i["kcal"] for i in out["items"])


def test_a_label_is_trusted_as_read():
    est = _est({"name": "無糖豆漿 400ml", "grams": 400, "kcal": 140, "protein": 14, "carbs": 6, "fat": 7, "table_name": "豆漿"})
    out = fe.check(est, "label")
    assert out["items"][0]["source"] == "label" and out["items"][0]["kcal"] == 140
    assert out["source"] == "label"


def test_nothing_in_is_zero_out():
    out = fe.check(_est(), "meal")
    assert out["totals"] == {"kcal": 0, "protein": 0, "carbs": 0, "fat": 0}
    assert out["items"] == []


def test_the_model_is_asked_with_the_photo_attached(monkeypatch):
    seen = {}

    class Fake:
        def invoke(self, msgs):
            seen["content"] = msgs[0].content
            return _est()

    def fake_estimator(vision):
        seen["vision"] = vision
        return Fake()

    monkeypatch.setattr(fe, "_estimator", fake_estimator)
    fe.estimate("一碗飯", b"\xff\xd8", "image/jpeg", "meal")
    assert seen["vision"] is True
    assert seen["content"][0]["type"] == "text" and "一碗飯" in seen["content"][0]["text"]
    assert seen["content"][1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    seen.clear()
    fe.estimate("兩顆蛋", None, "image/jpeg", "meal")
    assert seen["vision"] is False and len(seen["content"]) == 1
