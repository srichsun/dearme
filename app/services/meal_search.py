"""Turn a sentence into meal filters.

"夏天自己煮的點心，用氣炸鍋" becomes {category: snack, source: home_cooked,
season: summer, method: air_fryer}, and then the ordinary list query runs.
The model's only job is that translation: it never sees the meals, never
picks one, never writes prose. So the answer is always a subset of the
person's own list, and the screen can show the filters it chose for them to
correct.

If the model is down, slow, or talks nonsense, the sentence is used as a plain
keyword instead and the reply says so (`fallback`). A search must never fail
just because the clever part did.
"""
import logging

from pydantic import BaseModel, Field

from app.models import MEAL_CATEGORIES, METHODS, SEASONS, SOURCES
from app.services import chat_model, meals

log = logging.getLogger(__name__)

FILTER_FIELDS = ("q", "category", "source", "season", "method")


class _Filters(BaseModel):
    """What the sentence asked for. Every field optional; codes as strings
    so an odd answer drops one filter rather than the whole parse."""

    q: str | None = Field(
        default=None,
        description=(
            "a keyword to look for in a meal's name, recipe or note — a food, "
            "an ingredient, a brand. Empty if the sentence only names the "
            "categories below."
        ),
    )
    category: str | None = Field(default=None, description="breakfast | meal | snack")
    source: str | None = Field(default=None, description="eat_out | home_cooked")
    season: str | None = Field(default=None, description="summer | winter")
    method: str | None = Field(
        default=None, description="stir_fry | air_fryer | rice_cooker | microwave"
    )


_parser = chat_model.build_chat_model(
    timeout=chat_model.REPLY_TIMEOUT, worker=True
).with_structured_output(_Filters)

_PROMPT = """Translate this request about what to eat into search filters. Use only the codes listed; leave a field empty when the sentence doesn't mention it.

- category: 早餐/breakfast → breakfast; 正餐/午餐/晚餐/lunch/dinner → meal; 點心/零食/snack → snack
- source: 外食/買的/便利商店/超商/eat out → eat_out; 自己煮/自煮/home-made → home_cooked. 附近/最近/離我/現在可以吃 (asking what is around them now) → eat_out
- season: 夏天/熱天/summer → summer; 冬天/冷天/winter → winter. Never "all".
- method: 炒 → stir_fry; 氣炸鍋/氣炸 → air_fryer; 電鍋 → rice_cooker; 微波 → microwave
- q: one keyword for anything else worth matching (a food like 雞胸, a brand like 7-11), in the sentence's own language. Empty if nothing is left over.

Request: {text}"""

_KNOWN = {
    "category": MEAL_CATEGORIES,
    "source": SOURCES,
    "season": SEASONS,
    "method": METHODS,
}


def parse(text: str) -> dict:
    """Ask the model for filters and keep only the codes we know.

    Raises whatever the model raises — the caller decides what a failure
    means, and for a search it means "keyword instead".
    """
    parsed = _parser.invoke(_PROMPT.format(text=text))
    filters = {}
    for field, allowed in _KNOWN.items():
        value = getattr(parsed, field)
        if value in allowed and value != "all":
            filters[field] = value
    q = (parsed.q or "").strip()
    if q:
        filters["q"] = q
    return filters


def search(
    user_id: str, text: str, near: tuple[float, float] | None = None
) -> dict:
    """The sentence's filters, the meals they match, and whether the model
    was actually consulted. `near` sorts the answer by distance."""
    text = (text or "").strip()
    fallback = False
    try:
        filters = parse(text) if text else {}
    except Exception:
        log.exception("Could not parse a meal search; using it as a keyword")
        filters, fallback = {"q": text}, True
    rows = meals.list_meals(user_id, near=near, **filters)
    return {"filters": filters, "meals": rows, "fallback": fallback}
