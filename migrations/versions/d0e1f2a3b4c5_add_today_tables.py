"""add goals, habits, habit_checks

The "today" screen: one goal per person, a daily checklist, and a row per
habit per day it was done.

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "goals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "habits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.String(length=128), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_habits_user_id", "habits", ["user_id"])
    op.create_table(
        "habit_checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("habit_id", sa.Integer(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(["habit_id"], ["habits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("habit_id", "day", name="uq_habit_checks_habit_day"),
    )
    op.create_index("ix_habit_checks_habit_id", "habit_checks", ["habit_id"])


def downgrade() -> None:
    op.drop_index("ix_habit_checks_habit_id", table_name="habit_checks")
    op.drop_table("habit_checks")
    op.drop_index("ix_habits_user_id", table_name="habits")
    op.drop_table("habits")
    op.drop_table("goals")
