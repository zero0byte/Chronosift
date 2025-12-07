"""add_saved_queries

Revision ID: 20251109195028
Revises: 1dee71b7094d
Create Date: 2025-11-09 19:50:28

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20251109195028'
down_revision = '1dee71b7094d'
branch_labels = None
depends_on = None


def upgrade():
    """Create saved_queries table."""
    op.create_table(
        'saved_queries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timeline_id', sa.Integer(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('query_config', sa.JSON(), nullable=False),
        sa.Column('is_shared', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_pinned', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['timeline_id'], ['timelines.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='SET NULL')
    )
    
    # Create indexes for performance
    op.create_index('ix_saved_queries_timeline_id', 'saved_queries', ['timeline_id'])
    op.create_index('ix_saved_queries_created_by', 'saved_queries', ['created_by'])
    op.create_index('ix_saved_queries_team_id', 'saved_queries', ['team_id'])
    op.create_index('ix_saved_queries_is_shared', 'saved_queries', ['is_shared'])
    op.create_index('ix_saved_queries_is_pinned', 'saved_queries', ['is_pinned'])


def downgrade():
    """Drop saved_queries table."""
    op.drop_index('ix_saved_queries_is_pinned', 'saved_queries')
    op.drop_index('ix_saved_queries_is_shared', 'saved_queries')
    op.drop_index('ix_saved_queries_team_id', 'saved_queries')
    op.drop_index('ix_saved_queries_created_by', 'saved_queries')
    op.drop_index('ix_saved_queries_timeline_id', 'saved_queries')
    op.drop_table('saved_queries')
