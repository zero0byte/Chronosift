from datetime import datetime
from app import db


class TimestampMixin:
    """Mixin for created_at and updated_at timestamps."""
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


# Import all models for Alembic
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.project import Project, ProjectMember
from app.models.timeline import Timeline, ColumnDefinition, TimelineEntry
from app.models.transform import Transform
from app.models.view import SavedView
from app.models.saved_query import SavedQuery
from app.models.entity import Entity, EnrichmentProvider, EnrichmentResult, UserAPIKey
from app.models.comment import Comment, CommentMention
from app.models.activity import Activity
from app.models.report import Report, ReportTemplate
from app.models.ioc import IOC
from app.models.key_timestamp import KeyTimestamp
from app.models.attack_chain import AttackChain, AttackChainNode, AttackChainEdge
from app.models.entry_link import EntryLink
from app.models.mitre import (
    MitreTactic,
    MitreTechnique,
    TimelineAnalysisResult,
    TrainingDataset,
    TrainingExample
)
from app.models.job import Job
from app.models.analysis_prompt import AnalysisPrompt

__all__ = [
    'User',
    'Team',
    'TeamMember',
    'Project',
    'ProjectMember',
    'Timeline',
    'ColumnDefinition',
    'TimelineEntry',
    'Transform',
    'SavedView',
    'SavedQuery',
    'Entity',
    'EnrichmentProvider',
    'EnrichmentResult',
    'UserAPIKey',
    'Comment',
    'CommentMention',
    'Activity',
    'Report',
    'ReportTemplate',
    'IOC',
    'KeyTimestamp',
    'AttackChain',
    'AttackChainNode',
    'AttackChainEdge',
    'EntryLink',
    'MitreTactic',
    'MitreTechnique',
    'TimelineAnalysisResult',
    'TrainingDataset',
    'TrainingExample',
    'Job',
    'AnalysisPrompt'
]
