"""add meal kind

Free-text grouping (火鍋, 牛排, 海鮮, 超商) so the list can be browsed by
kind before by dish. Indexed: the kinds screen counts by it.

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meals", sa.Column("kind", sa.String(length=64), nullable=True))
    op.create_index("ix_meals_kind", "meals", ["kind"])


def downgrade() -> None:
    op.drop_index("ix_meals_kind", table_name="meals")
    op.drop_column("meals", "kind")
