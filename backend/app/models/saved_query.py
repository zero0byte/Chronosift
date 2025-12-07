"""Saved query model for storing filter queries."""
from app import db
from app.models import TimestampMixin


class SavedQuery(db.Model, TimestampMixin):
    """
    Saved filter query for timelines.
    
    Similar to SavedView but focuses on filter/search queries rather than display settings.
    """
    
    __tablename__ = 'saved_queries'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id', ondelete='CASCADE'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True)
    
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    
    # Filter configuration (JSON)
    # Example structure:
    # {
    #   "search_text": "192.168.1.1",
    #   "field_filters": [
    #     {"field": "timestamp", "operator": "between", "value": ["2023-01-01", "2023-12-31"]},
    #     {"field": "level", "operator": "equals", "value": "error"},
    #     {"field": "computer", "operator": "contains", "value": "WIN-"}
    #   ],
    #   "enrichment_filters": {
    #     "has_enrichment": true,
    #     "providers": ["greynoise", "abuseipdb"],
    #     "min_confidence": 0.7,
    #     "entity_types": ["ip"]
    #   },
    #   "logic": "AND"  # How to combine filters: AND or OR
    # }
    query_config = db.Column(db.JSON, nullable=False)
    
    # Sharing settings
    is_shared = db.Column(db.Boolean, default=False, nullable=False)  # Share with team
    is_pinned = db.Column(db.Boolean, default=False, nullable=False)  # Pin to top of list
    
    # Relationships
    timeline = db.relationship('Timeline', backref='saved_queries')
    creator = db.relationship('User', foreign_keys=[created_by])
    team = db.relationship('Team', backref='saved_queries')
    
    def to_dict(self):
        """Serialize to dictionary."""
        return {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'created_by': self.created_by,
            'team_id': self.team_id,
            'name': self.name,
            'description': self.description,
            'query_config': self.query_config,
            'is_shared': self.is_shared,
            'is_pinned': self.is_pinned,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'creator_name': self.creator.full_name if self.creator else None
        }
    
    def __repr__(self):
        return f'<SavedQuery {self.name} (Timeline {self.timeline_id})>'
