"""The Taiwan food table: loads, matches sensibly, scales by grams."""
from app.services import nutrition_db as ndb


def test_the_table_is_there_and_complete():
    rows = ndb.foods()
    assert len(rows) > 2000
    potato = next(r for r in rows if r["name"] == "馬鈴薯")
    assert potato["kcal"] == 74 and potato["protein"] == 2.6
    assert all(r["kcal"] is not None for r in rows)


def test_exact_name_and_alias_match():
    assert ndb.match("馬鈴薯")["name"] == "馬鈴薯"
    assert ndb.match("洋芋")["name"] == "馬鈴薯"  # an alias
    assert ndb.match(" 馬鈴薯 ")["name"] == "馬鈴薯"


def test_longest_contained_name_wins_and_short_junk_does_not():
    assert ndb.match("水煮馬鈴薯")["name"] == "馬鈴薯"
    assert ndb.match("") is None
    assert ndb.match("x") is None
    assert ndb.match("不存在的東西xyz") is None


def test_scaling_by_grams():
    potato = ndb.match("馬鈴薯")
    assert ndb.per_grams(potato, 200) == {"kcal": 148.0, "protein": 5.2, "fat": 0.4, "carbs": 31.6}
    assert ndb.per_grams(potato, 0)["kcal"] == 0
    assert ndb.per_grams(potato, -5)["kcal"] == 0
