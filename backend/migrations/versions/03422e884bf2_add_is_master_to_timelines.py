"""add is_master to timelines

Revision ID: 03422e884bf2
Revises: 74860be27ce5
Create Date: 2025-11-06 15:41:52.365809

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '03422e884bf2'
down_revision = '74860be27ce5'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('timelines', sa.Column('is_master', sa.Boolean(), nullable=True, server_default='false'))


def downgrade():
    op.drop_column('timelines', 'is_master')
