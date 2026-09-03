"""reward videos remember the day they were unlocked

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, Sequence[str], None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("reward_videos", sa.Column("unlocked_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("reward_videos", "unlocked_on")
