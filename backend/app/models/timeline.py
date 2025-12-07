from app import db
from app.models import TimestampMixin
from sqlalchemy.dialects.postgresql import JSONB


class Timeline(db.Model, TimestampMixin):
    """Timeline model for organizing temporal data."""
    
    __tablename__ = 'timelines'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_master = db.Column(db.Boolean, default=False)  # Master timeline flag
    
    # Relationships
    project = db.relationship('Project', back_populates='timelines')
    creator = db.relationship('User', foreign_keys=[created_by], back_populates='created_timelines')
    columns = db.relationship('ColumnDefinition', back_populates='timeline', cascade='all, delete-orphan', order_by='ColumnDefinition.order')
    entries = db.relationship('TimelineEntry', back_populates='timeline', cascade='all, delete-orphan')
    saved_views = db.relationship('SavedView', back_populates='timeline', cascade='all, delete-orphan')
    
    def to_dict(self, include_columns=False, include_entries=False):
        """Serialize timeline to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'project_id': self.project_id,
            'created_by': self.created_by,
            'is_master': self.is_master,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'entry_count': len(self.entries)
        }
        if include_columns:
            data['columns'] = [col.to_dict() for col in self.columns]
        if include_entries:
            data['entries'] = [entry.to_dict() for entry in self.entries]
        return data
    
    def __repr__(self):
        return f'<Timeline {self.name}>'


class ColumnDefinition(db.Model, TimestampMixin):
    """Column definition for timeline table structure."""
    
    __tablename__ = 'column_definitions'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    column_type = db.Column(db.String(50), nullable=False)  # timestamp, text, number, tags, multiselect, boolean
    config = db.Column(JSONB, default={})  # Type-specific configuration (e.g., multiselect options)
    order = db.Column(db.Integer, nullable=False)
    is_required = db.Column(db.Boolean, default=False)
    is_searchable = db.Column(db.Boolean, default=True)
    
    # Relationships
    timeline = db.relationship('Timeline', back_populates='columns')
    
    def to_dict(self):
        """Serialize column definition to dictionary."""
        return {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'name': self.name,
            'column_type': self.column_type,
            'config': self.config,
            'order': self.order,
            'is_required': self.is_required,
            'is_searchable': self.is_searchable,
            'created_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<ColumnDefinition {self.name} ({self.column_type})>'


class TimelineEntry(db.Model, TimestampMixin):
    """Individual entry/row in a timeline."""
    
    __tablename__ = 'timeline_entries'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id'), nullable=False)
    data = db.Column(JSONB, nullable=False)  # Flexible storage for column values
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    timeline = db.relationship('Timeline', back_populates='entries')
    creator = db.relationship('User', back_populates='timeline_entries')
    entities = db.relationship('Entity', back_populates='timeline_entry', cascade='all, delete-orphan')
    comments = db.relationship('Comment', back_populates='entry', cascade='all, delete-orphan')
    
    # Index for faster querying
    __table_args__ = (
        db.Index('idx_timeline_entries_timeline_id', 'timeline_id'),
        db.Index('idx_timeline_entries_data', 'data', postgresql_using='gin'),
    )
    
    def to_dict(self, include_analysis=True):
        """Serialize timeline entry to dictionary."""
        result = {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'data': self.data,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_analysis:
            # Include LLM analysis results
            result['analysis'] = {
                'priority': None,
                'attack_mapping': None
            }
            
            for analysis in self.analysis_results:
                if analysis.analysis_type == 'prioritization':
                    result['analysis']['priority'] = {
                        'score': analysis.priority_score,
                        'confidence': analysis.confidence_score,
                        'explanation': analysis.explanation
                    }
                elif analysis.analysis_type == 'attack_mapping':
                    result['analysis']['attack_mapping'] = {
                        'technique': analysis.mitre_technique.to_dict() if analysis.mitre_technique else None,
                        'tactic': analysis.mitre_tactic.to_dict() if analysis.mitre_tactic else None,
                        'confidence': analysis.confidence_score,
                        'explanation': analysis.explanation
                    }
        
        return result
    
    def __repr__(self):
        return f'<TimelineEntry {self.id}>'
