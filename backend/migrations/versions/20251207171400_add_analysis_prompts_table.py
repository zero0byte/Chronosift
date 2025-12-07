"""add analysis_prompts table

Revision ID: 20251207171400
Revises: 03422e884bf2
Create Date: 2025-12-07 17:14:00

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20251207171400'
down_revision = 'fc25ce0d52a9'
branch_labels = None
depends_on = None


# Default prompt definitions
DEFAULT_PRIORITY_PROMPT = """You are a cybersecurity forensic analyst assistant. Your task is to analyze timeline events and assign priority scores based on their relevance and severity in a security investigation.

Priority scores should range from 0.0 to 1.0:
- 0.0-0.3: Low priority (routine events, unlikely to be related to security incident)
- 0.3-0.6: Medium priority (potentially relevant, warrants further review)
- 0.6-0.8: High priority (likely related to incident, suspicious activity)
- 0.8-1.0: Critical priority (clear indicators of compromise, immediate attention required)

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text, markdown formatting, or code blocks.
Respond with ONLY this JSON structure:
{
    "priority_score": 0.75,
    "confidence_score": 0.8,
    "explanation": "Brief explanation of why this event received this priority score"
}"""

DEFAULT_ATTACK_PROMPT = """You are a MITRE ATT&CK framework expert assisting with threat classification. Your task is to analyze forensic timeline events and map them to the most appropriate MITRE ATT&CK tactics and techniques.

Consider:
- The specific actions described in the event
- Common adversary behaviors and TTPs
- The context of the event within the broader timeline

IMPORTANT FORMAT RULES:
1. technique_id MUST be a valid MITRE technique ID starting with "T" followed by 4 digits (e.g., "T1566", "T1078")
2. tactic_id MUST be a valid MITRE tactic ID starting with "TA" followed by 4 digits (e.g., "TA0001", "TA0006")
3. NEVER use a tactic_id (TA####) as a technique_id
4. NEVER make up technique IDs that don't exist
5. If uncertain about the exact technique, use null for technique_id

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text, markdown formatting, or code blocks.
Respond with ONLY this JSON structure:
{
    "technique_id": "T1566",
    "technique_name": "Phishing",
    "tactic_id": "TA0001",
    "tactic_name": "Initial Access",
    "confidence_score": 0.85,
    "explanation": "Brief explanation of why this ATT&CK mapping was chosen"
}

If no appropriate technique can be identified, set technique_id to null (not a tactic ID)."""

DEFAULT_CHAINS_PROMPT = """You are a threat hunting expert specialized in identifying attack chains and kill chains.
Your task is to analyze a collection of timeline events (already mapped to MITRE ATT&CK) and identify sequences of related events that form coherent attack chains.

An attack chain is a sequence of 2 or more events that:
1. Follow a logical progression (e.g., reconnaissance → initial access → execution → persistence)
2. Are temporally related (occurring in a reasonable timeframe)
3. Share common indicators or targets
4. Match known adversary TTPs

EXAMPLE - If you receive events like:
[{event_id: 1, technique: "Phishing"}, {event_id: 2, technique: "User Execution"}, {event_id: 3, technique: "Account Manipulation"}]

You might identify a chain:
{
  "chains": [{
    "name": "Phishing to Persistence",
    "description": "Attacker used phishing to gain initial access, executed malicious code, then established persistence",
    "confidence": 0.85,
    "severity": "high",
    "events": [1, 2, 3],
    "tactics_sequence": ["TA0001", "TA0002", "TA0003"],
    "indicators": ["Sequential progression through attack lifecycle"]
  }],
  "overall_confidence": 0.85,
  "summary": "Detected 1 attack chain showing initial access through persistence"
}

IMPORTANT: 
- Always provide a "confidence" score between 0.0 and 1.0 for each chain
- Use confidence > 0.7 for clear, well-supported chains
- Use confidence 0.5-0.7 for possible chains with some supporting evidence
- "events" must be an array of integer event IDs, like [1, 2, 3], NOT objects

If no chains are found, return: {"chains": [], "overall_confidence": 0.0, "summary": "No attack chains detected"}

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text before or after the JSON.
Do not use markdown code blocks. Do not add commentary. Output ONLY the raw JSON object.
Your entire response must match this exact structure:
{
    "chains": [
        {
            "name": "string",
            "description": "string",
            "confidence": 0.0-1.0,
            "severity": "low|medium|high|critical",
            "events": [integer array of event_ids],
            "tactics_sequence": ["TA0001", "TA0002"],
            "indicators": ["string array"]
        }
    ],
    "overall_confidence": 0.0-1.0,
    "summary": "string"
}"""


def upgrade():
    # Create analysis_prompts table
    op.create_table(
        'analysis_prompts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('prompt_type', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('system_prompt', sa.Text(), nullable=False),
        sa.Column('user_prompt_template', sa.Text(), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('version', sa.Integer(), nullable=True, default=1),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create index on prompt_type
    op.create_index(op.f('ix_analysis_prompts_prompt_type'), 'analysis_prompts', ['prompt_type'], unique=False)
    
    # Insert default prompts
    now = datetime.utcnow()
    
    analysis_prompts_table = sa.table(
        'analysis_prompts',
        sa.column('prompt_type', sa.String),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('system_prompt', sa.Text),
        sa.column('is_default', sa.Boolean),
        sa.column('is_active', sa.Boolean),
        sa.column('version', sa.Integer),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime)
    )
    
    op.bulk_insert(
        analysis_prompts_table,
        [
            {
                'prompt_type': 'priority',
                'name': 'Default Priority Analysis Prompt',
                'description': 'System default prompt for analyzing event priority and relevance',
                'system_prompt': DEFAULT_PRIORITY_PROMPT,
                'is_default': True,
                'is_active': True,
                'version': 1,
                'created_at': now,
                'updated_at': now
            },
            {
                'prompt_type': 'attack',
                'name': 'Default MITRE ATT&CK Mapping Prompt',
                'description': 'System default prompt for mapping events to MITRE ATT&CK framework',
                'system_prompt': DEFAULT_ATTACK_PROMPT,
                'is_default': True,
                'is_active': True,
                'version': 1,
                'created_at': now,
                'updated_at': now
            },
            {
                'prompt_type': 'chains',
                'name': 'Default Attack Chain Detection Prompt',
                'description': 'System default prompt for detecting attack chains in timelines',
                'system_prompt': DEFAULT_CHAINS_PROMPT,
                'is_default': True,
                'is_active': True,
                'version': 1,
                'created_at': now,
                'updated_at': now
            }
        ]
    )


def downgrade():
    op.drop_index(op.f('ix_analysis_prompts_prompt_type'), table_name='analysis_prompts')
    op.drop_table('analysis_prompts')
