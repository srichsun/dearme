"""add meal place

The shop behind an eat-out meal: Google's id and name, address, phone,
coordinates, and the Maps link. Coordinates are what "nearest" needs.

Revision ID: b8c9d0e1f2a3
Revises: a7b8c9d0e1f2
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b8c9d0e1f2a3"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    ("place_id", sa.String(length=255)),
    ("place_name", sa.String(length=200)),
    ("address", sa.Text()),
    ("phone", sa.String(length=64)),
    ("lat", sa.Float()),
    ("lng", sa.Float()),
    ("maps_url", sa.Text()),
)


def upgrade() -> None:
    for name, kind in COLUMNS:
        op.add_column("meals", sa.Column(name, kind, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column("meals", name)
