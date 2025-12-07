"""add_comments_and_activity

Revision ID: 20251111183314
Revises: 20251109195028
Create Date: 2025-11-11 18:33:14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251111183314'
down_revision = '20251109195028'
branch_labels = None
depends_on = None


def upgrade():
    """Create comments, comment_mentions, and activities tables."""
    
    # Create comments table
    op.create_table(
        'comments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entry_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('parent_id', sa.Integer(), nullable=True),
        sa.Column('is_edited', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['entry_id'], ['timeline_entries.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['comments.id'], ondelete='CASCADE')
    )
    
    # Create indexes for comments
    op.create_index('idx_comments_entry_id', 'comments', ['entry_id'])
    op.create_index('idx_comments_user_id', 'comments', ['user_id'])
    op.create_index('idx_comments_parent_id', 'comments', ['parent_id'])
    
    # Create comment_mentions table
    op.create_table(
        'comment_mentions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('comment_id', sa.Integer(), nullable=False),
        sa.Column('mentioned_user_id', sa.Integer(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['comment_id'], ['comments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mentioned_user_id'], ['users.id'], ondelete='CASCADE')
    )
    
    # Create indexes for comment_mentions
    op.create_index('idx_mentions_user_id', 'comment_mentions', ['mentioned_user_id'])
    op.create_index('idx_mentions_comment_id', 'comment_mentions', ['comment_id'])
    
    # Create activities table
    op.create_table(
        'activities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('project_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('activity_type', sa.String(length=50), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('meta_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    
    # Create indexes for activities
    op.create_index('idx_activities_project_id', 'activities', ['project_id'])
    op.create_index('idx_activities_user_id', 'activities', ['user_id'])
    op.create_index('idx_activities_created_at', 'activities', ['created_at'])
    op.create_index('idx_activities_type', 'activities', ['activity_type'])


def downgrade():
    """Drop comments, comment_mentions, and activities tables."""
    
    # Drop activities table
    op.drop_index('idx_activities_type', 'activities')
    op.drop_index('idx_activities_created_at', 'activities')
    op.drop_index('idx_activities_user_id', 'activities')
    op.drop_index('idx_activities_project_id', 'activities')
    op.drop_table('activities')
    
    # Drop comment_mentions table
    op.drop_index('idx_mentions_comment_id', 'comment_mentions')
    op.drop_index('idx_mentions_user_id', 'comment_mentions')
    op.drop_table('comment_mentions')
    
    # Drop comments table
    op.drop_index('idx_comments_parent_id', 'comments')
    op.drop_index('idx_comments_user_id', 'comments')
    op.drop_index('idx_comments_entry_id', 'comments')
    op.drop_table('comments')
