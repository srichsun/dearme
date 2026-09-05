"""add food_items

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b0c1d2e3f4a5"
down_revision: Union[str, Sequence[str], None] = "a9b0c1d2e3f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "food_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("kcal_100", sa.Float(), nullable=False),
        sa.Column("protein_100", sa.Float(), nullable=False),
        sa.Column("carbs_100", sa.Float(), nullable=False),
        sa.Column("fat_100", sa.Float(), nullable=False),
        sa.Column("serving_g", sa.Float(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_items_user_id", "food_items", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_food_items_user_id", table_name="food_items")
    op.drop_table("food_items")
