"""add shopping_items

Revision ID: a3b4c5d6e7f8
Revises: f2a3b4c5d6e7
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "shopping_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("section", sa.String(length=32), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_shopping_items_user_id", "shopping_items", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_shopping_items_user_id", table_name="shopping_items")
    op.drop_table("shopping_items")
