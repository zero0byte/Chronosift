from app import db
from app.models import TimestampMixin
from sqlalchemy.dialects.postgresql import JSONB


class Activity(db.Model, TimestampMixin):
    """Activity feed model for tracking project actions."""
    
    __tablename__ = 'activities'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    activity_type = db.Column(db.String(50), nullable=False)  # 'entry_created', 'comment_added', 'entry_promoted', etc.
    entity_type = db.Column(db.String(50))  # 'timeline', 'entry', 'comment'
    entity_id = db.Column(db.Integer)
    meta_data = db.Column(JSONB, default={})  # Additional context (e.g., timeline name, entry data preview)
    
    # Relationships
    project = db.relationship('Project', back_populates='activities')
    user = db.relationship('User', back_populates='activities')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_activities_project_id', 'project_id'),
        db.Index('idx_activities_user_id', 'user_id'),
        db.Index('idx_activities_created_at', 'created_at'),
        db.Index('idx_activities_type', 'activity_type'),
    )
    
    def to_dict(self):
        """Serialize activity to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'user': self.user.to_dict(include_email=False),
            'activity_type': self.activity_type,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'metadata': self.meta_data,
            'created_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<Activity {self.activity_type} by User {self.user_id}>'
