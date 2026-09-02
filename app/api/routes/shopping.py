"""The shopping list, scoped to the signed-in person."""
from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUid
from app.schemas.shopping import ItemPatch, ItemWrite
from app.services import shopping
from app.services.shopping import ShoppingError

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


@router.get("")
def list_items(uid: CurrentUid):
    return {"items": shopping.list_items(uid)}


@router.post("", status_code=201)
def add_item(req: ItemWrite, uid: CurrentUid):
    try:
        return shopping.add_item(uid, req.section, req.text)
    except ShoppingError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/clear-done")
def clear_done(uid: CurrentUid):
    return {"cleared": shopping.clear_done(uid)}


@router.patch("/{item_id}")
def update_item(item_id: int, req: ItemPatch, uid: CurrentUid):
    try:
        item = shopping.update_item(uid, item_id, text=req.text, done=req.done)
    except ShoppingError as e:
        raise HTTPException(status_code=422, detail=str(e))
    if item is None:
        raise HTTPException(status_code=404, detail="No such item")
    return item


@router.delete("/{item_id}")
def delete_item(item_id: int, uid: CurrentUid):
    if not shopping.delete_item(uid, item_id):
        raise HTTPException(status_code=404, detail="No such item")
    return {"deleted": item_id}
