"""Key Timestamp model for marking important moments in investigations."""
from datetime import datetime
from app import db


class KeyTimestamp(db.Model):
    """
    Key timestamps represent important moments in an investigation.
    They can be used to mark events like "Initial Compromise", "Lateral Movement Detected",
    "Ransomware Deployment", etc., and search across all timelines for entries near these moments.
    """
    __tablename__ = 'key_timestamps'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    timestamp = db.Column(db.DateTime, nullable=False, index=True)
    label = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    color = db.Column(db.String(20), default='#2563EB')  # Hex color for visualization
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref=db.backref('key_timestamps', lazy='dynamic', cascade='all, delete-orphan'))
    creator = db.relationship('User', backref='key_timestamps')
    
    def to_dict(self):
        """Convert to dictionary representation."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'label': self.label,
            'description': self.description,
            'color': self.color,
            'created_by': self.created_by,
            'creator_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<KeyTimestamp {self.label} @ {self.timestamp}>'
