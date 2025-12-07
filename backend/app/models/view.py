from app import db
from app.models import TimestampMixin
from sqlalchemy.dialects.postgresql import JSONB


class SavedView(db.Model, TimestampMixin):
    """Saved view configurations for timelines."""
    
    __tablename__ = 'saved_views'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_pinned = db.Column(db.Boolean, default=False)
    is_shared = db.Column(db.Boolean, default=False)  # Shared with project members
    
    # View configuration
    filter_config = db.Column(JSONB, default={})  # Filter criteria
    sort_config = db.Column(JSONB, default={})  # Sort settings
    visible_columns = db.Column(JSONB, default=[])  # Which columns to show
    column_widths = db.Column(JSONB, default={})  # Column width settings
    
    # Relationships
    timeline = db.relationship('Timeline', back_populates='saved_views')
    
    def to_dict(self):
        """Serialize saved view to dictionary."""
        return {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'is_pinned': self.is_pinned,
            'is_shared': self.is_shared,
            'filter_config': self.filter_config,
            'sort_config': self.sort_config,
            'visible_columns': self.visible_columns,
            'column_widths': self.column_widths,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<SavedView {self.name}>'
