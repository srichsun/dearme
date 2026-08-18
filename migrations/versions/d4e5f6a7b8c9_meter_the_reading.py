"""meter the reading

Rebuilding the reading spends a model call, and until now it could be pressed
without limit. Metered the same way analysing a day is, so there is one rule to
learn rather than two.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("rebuilt_on", sa.Date(), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("rebuild_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("profiles", "rebuild_count")
    op.drop_column("profiles", "rebuilt_on")
