from app import db
from app.models import TimestampMixin
from sqlalchemy.dialects.postgresql import JSONB


class Transform(db.Model, TimestampMixin):
    """Transform model for defining data parsing rules."""
    
    __tablename__ = 'transforms'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    input_format = db.Column(db.String(50), nullable=False)  # csv, json, xml, etc.
    mapping = db.Column(JSONB, nullable=False)  # Field mappings and transformation rules
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'))  # If shared with team
    is_public = db.Column(db.Boolean, default=False)  # Publicly available to all users
    imported_via_api = db.Column(db.Boolean, default=False)  # Whether created via API import
    
    # Relationships
    creator = db.relationship('User', back_populates='created_transforms')
    
    def to_dict(self):
        """Serialize transform to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'input_format': self.input_format,
            'mapping': self.mapping,
            'created_by': self.created_by,
            'team_id': self.team_id,
            'is_public': self.is_public,
            'imported_via_api': self.imported_via_api,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<Transform {self.name}>'
