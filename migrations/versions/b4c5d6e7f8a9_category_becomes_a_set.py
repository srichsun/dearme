"""category becomes a set

A meal can be breakfast and a main meal. Packed like proteins:
",breakfast,meal,". Existing rows are wrapped in commas.

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b4c5d6e7f8a9"
down_revision: Union[str, Sequence[str], None] = "a3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("meals", "category", type_=sa.String(length=64), existing_type=sa.String(length=32))
    op.execute("UPDATE meals SET category = ',' || category || ',' WHERE category NOT LIKE ',%'")


def downgrade() -> None:
    # Keep the first of the set; the rest cannot fit a single value.
    op.execute(
        "UPDATE meals SET category = split_part(trim(both ',' from category), ',', 1) "
        "WHERE category LIKE ',%'"
    )
    op.alter_column("meals", "category", type_=sa.String(length=32), existing_type=sa.String(length=64))
