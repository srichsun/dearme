"""The shopping list. Plain CRUD, scoped by user like everything else."""
from sqlalchemy import delete, select

from app.core import db
from app.models import SECTIONS, ShoppingItem


class ShoppingError(ValueError):
    pass


def _dict(i: ShoppingItem) -> dict:
    return {"id": i.id, "section": i.section, "text": i.text, "done": i.done}


def list_items(user_id: str) -> list[dict]:
    if not user_id:
        return []
    order = {s: n for n, s in enumerate(SECTIONS)}
    with db.get_session() as s:
        rows = list(s.scalars(select(ShoppingItem).where(ShoppingItem.user_id == user_id)))
    rows.sort(key=lambda i: (order.get(i.section, 99), i.position, i.id))
    return [_dict(i) for i in rows]


def add_item(user_id: str, section: str, text: str) -> dict:
    text = (text or "").strip()
    if not text:
        raise ShoppingError("An item can't be empty")
    if section not in SECTIONS:
        raise ShoppingError(f"Unknown section {section!r}")
    with db.get_session() as s:
        last = s.scalar(
            select(ShoppingItem.position)
            .where(ShoppingItem.user_id == user_id, ShoppingItem.section == section)
            .order_by(ShoppingItem.position.desc()).limit(1)
        )
        item = ShoppingItem(user_id=user_id, section=section, text=text, position=(last or 0) + 1)
        s.add(item)
        s.commit()
        return _dict(item)


def update_item(user_id: str, item_id: int, *, text: str | None = None, done: bool | None = None) -> dict | None:
    """Rename and/or tick. None if it isn't theirs; ShoppingError on a blank rename."""
    if text is not None and not text.strip():
        raise ShoppingError("An item can't be empty")
    with db.get_session() as s:
        item = s.scalar(select(ShoppingItem).where(ShoppingItem.id == item_id, ShoppingItem.user_id == user_id))
        if item is None:
            return None
        if text is not None:
            item.text = text.strip()
        if done is not None:
            item.done = done
        s.commit()
        return _dict(item)


def delete_item(user_id: str, item_id: int) -> bool:
    with db.get_session() as s:
        item = s.scalar(select(ShoppingItem).where(ShoppingItem.id == item_id, ShoppingItem.user_id == user_id))
        if item is None:
            return False
        s.delete(item)
        s.commit()
        return True


def clear_done(user_id: str) -> int:
    """Drop everything ticked. Returns how many went."""
    if not user_id:
        return 0
    with db.get_session() as s:
        result = s.execute(
            delete(ShoppingItem).where(ShoppingItem.user_id == user_id, ShoppingItem.done.is_(True))
        )
        s.commit()
        return result.rowcount
