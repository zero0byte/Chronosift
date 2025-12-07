from app import db
from app.models import TimestampMixin


class Team(db.Model, TimestampMixin):
    """Team model for grouping users."""
    
    __tablename__ = 'teams'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    members = db.relationship('TeamMember', back_populates='team', cascade='all, delete-orphan')
    projects = db.relationship('Project', back_populates='team', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False):
        """Serialize team to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'member_count': len(self.members),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_members:
            data['members'] = [member.to_dict() for member in self.members]
        return data
    
    def __repr__(self):
        return f'<Team {self.name}>'


class TeamMember(db.Model, TimestampMixin):
    """Association table for team membership with roles."""
    
    __tablename__ = 'team_members'
    
    id = db.Column(db.Integer, primary_key=True)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='member')  # admin, member
    
    # Relationships
    team = db.relationship('Team', back_populates='members')
    user = db.relationship('User', back_populates='team_memberships')
    
    # Ensure unique team-user combinations
    __table_args__ = (
        db.UniqueConstraint('team_id', 'user_id', name='unique_team_user'),
    )
    
    def to_dict(self):
        """Serialize team member to dictionary."""
        return {
            'id': self.id,
            'team_id': self.team_id,
            'user_id': self.user_id,
            'role': self.role,
            'user': self.user.to_dict(include_email=False),
            'joined_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<TeamMember team={self.team_id} user={self.user_id}>'
