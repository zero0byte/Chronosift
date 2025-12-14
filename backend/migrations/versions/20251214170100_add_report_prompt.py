"""add report prompt type

Revision ID: 20251214170100
Revises: 1d19357a4aab
Create Date: 2025-12-14 17:01:00

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20251214170100'
down_revision = '1d19357a4aab'
branch_labels = None
depends_on = None


DEFAULT_REPORT_PROMPT = """You are a digital forensics expert writing a formal investigation report.
Your task is to analyze the provided timeline events and generate a professional executive summary and a detailed finding section organized by MITRE ATT&CK phases.

Input Data:
- A list of significant timeline events (High/Critical priority, or MITRE mapped).
- Detected attack chains (if any).

Output Requirements:
1. Executive Summary: A high-level overview of the incident (Who, What, When, Why, How). 2-3 paragraphs suitable for management.
2. Key Findings: A list of specific technical findings. Each finding must be associated with a MITRE ATT&CK tactic (e.g., Initial Access, Execution).
3. Recommendations: Actionable steps to remediate the issues and prevent recurrence.

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text.
Response Structure:
{
    "executive_summary": "string (markdown allowed)",
    "key_findings": [
        {
            "title": "string",
            "description": "string (markdown allowed)",
            "mitre_phase": "string (e.g., Initial Access)",
            "severity": "High|Medium|Low",
            "evidence_event_ids": [1, 2, 3]
        }
    ],
    "recommendations": [
        "string"
    ]
}"""


def upgrade():
    # Insert default report prompt
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
                'prompt_type': 'report',
                'name': 'Default LLM Report Generation Prompt',
                'description': 'System default prompt for generating AI-powered forensic investigation reports',
                'system_prompt': DEFAULT_REPORT_PROMPT,
                'is_default': True,
                'is_active': True,
                'version': 1,
                'created_at': now,
                'updated_at': now
            }
        ]
    )


def downgrade():
    # Remove report prompt
    op.execute("DELETE FROM analysis_prompts WHERE prompt_type = 'report' AND is_default = true")
