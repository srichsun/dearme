"""add food_logs and nutrition_targets

Revision ID: a9b0c1d2e3f4
Revises: f8a9b0c1d2e3
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b0c1d2e3f4"
down_revision: Union[str, Sequence[str], None] = "f8a9b0c1d2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "food_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("eaten_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("kcal", sa.Float(), nullable=False),
        sa.Column("protein", sa.Float(), nullable=False),
        sa.Column("carbs", sa.Float(), nullable=False),
        sa.Column("fat", sa.Float(), nullable=False),
        sa.Column("items", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=16), nullable=False),
        sa.Column("meal_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_food_logs_user_id", "food_logs", ["user_id"])
    op.create_index("ix_food_logs_day", "food_logs", ["day"])
    op.create_table(
        "nutrition_targets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("kcal", sa.Integer(), nullable=False),
        sa.Column("protein", sa.Integer(), nullable=False),
        sa.Column("carbs", sa.Integer(), nullable=False),
        sa.Column("fat", sa.Integer(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("nutrition_targets")
    op.drop_index("ix_food_logs_day", table_name="food_logs")
    op.drop_index("ix_food_logs_user_id", table_name="food_logs")
    op.drop_table("food_logs")
