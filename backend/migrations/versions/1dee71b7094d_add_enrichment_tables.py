"""add_enrichment_tables

Revision ID: 1dee71b7094d
Revises: 03422e884bf2
Create Date: 2025-11-07 13:53:53.689804

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '1dee71b7094d'
down_revision = '03422e884bf2'
branch_labels = None
depends_on = None


def upgrade():
    # Create enrichment_providers table
    op.create_table('enrichment_providers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('requires_api_key', sa.Boolean(), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=True),
        sa.Column('config', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create entities table
    op.create_table('entities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('timeline_entry_id', sa.Integer(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False),
        sa.Column('value', sa.String(length=512), nullable=False),
        sa.Column('context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['timeline_entry_id'], ['timeline_entries.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('timeline_entry_id', 'entity_type', 'value', name='unique_entity_per_entry')
    )
    op.create_index(op.f('ix_entities_value'), 'entities', ['value'], unique=False)
    
    # Create user_api_keys table
    op.create_table('user_api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=False),
        sa.Column('encrypted_key', sa.Text(), nullable=False),
        sa.Column('key_name', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['provider_id'], ['enrichment_providers.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'provider_id', name='unique_user_provider_key')
    )
    
    # Create enrichment_results table
    op.create_table('enrichment_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('entity_id', sa.Integer(), nullable=False),
        sa.Column('provider_id', sa.Integer(), nullable=False),
        sa.Column('data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ),
        sa.ForeignKeyConstraint(['provider_id'], ['enrichment_providers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Insert default IP enrichment providers
    op.execute("""
        INSERT INTO enrichment_providers (name, entity_type, description, requires_api_key, is_enabled, config, created_at, updated_at)
        VALUES 
        ('greynoise', 'ip', 'GreyNoise - Identify internet scanners and noise', false, true, '{"base_url": "https://api.greynoise.io/v3/community", "cache_ttl": 3600}', NOW(), NOW()),
        ('abuseipdb', 'ip', 'AbuseIPDB - IP reputation and abuse reports', true, true, '{"base_url": "https://api.abuseipdb.com/api/v2/check", "cache_ttl": 3600}', NOW(), NOW()),
        ('virustotal_ip', 'ip', 'VirusTotal - IP reputation from multiple sources', true, true, '{"base_url": "https://www.virustotal.com/api/v3/ip_addresses", "cache_ttl": 3600}', NOW(), NOW()),
        ('ipinfo', 'ip', 'IPInfo.io - IP geolocation and ASN information', true, true, '{"base_url": "https://ipinfo.io", "cache_ttl": 7200}', NOW(), NOW())
    """)


def downgrade():
    op.drop_table('enrichment_results')
    op.drop_table('user_api_keys')
    op.drop_index(op.f('ix_entities_value'), table_name='entities')
    op.drop_table('entities')
    op.drop_table('enrichment_providers')
