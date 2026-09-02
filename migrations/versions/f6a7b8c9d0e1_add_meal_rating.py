"""add meal rating

How good it actually was, 1-10, once eaten. Optional: a meal goes on the
list before it has been tried.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meals", sa.Column("rating", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("meals", "rating")
