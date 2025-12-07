from app import db
from app.models import TimestampMixin


class Project(db.Model, TimestampMixin):
    """Project/Case model for organizing timelines."""
    
    __tablename__ = 'projects'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    team_id = db.Column(db.Integer, db.ForeignKey('teams.id'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(50), default='active')  # active, archived, closed
    
    # Relationships
    team = db.relationship('Team', back_populates='projects')
    creator = db.relationship('User', foreign_keys=[created_by], back_populates='created_projects')
    members = db.relationship('ProjectMember', back_populates='project', cascade='all, delete-orphan')
    timelines = db.relationship('Timeline', back_populates='project', cascade='all, delete-orphan')
    activities = db.relationship('Activity', back_populates='project', cascade='all, delete-orphan')
    
    def to_dict(self, include_members=False):
        """Serialize project to dictionary."""
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'team_id': self.team_id,
            'created_by': self.created_by,
            'status': self.status,
            'timeline_count': len(self.timelines),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_members:
            data['members'] = [member.to_dict() for member in self.members]
        return data
    
    def __repr__(self):
        return f'<Project {self.name}>'


class ProjectMember(db.Model, TimestampMixin):
    """Association table for project membership with permissions."""
    
    __tablename__ = 'project_members'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    permissions = db.Column(db.String(50), nullable=False, default='read')  # read, write, admin
    
    # Relationships
    project = db.relationship('Project', back_populates='members')
    user = db.relationship('User', back_populates='project_memberships')
    
    # Ensure unique project-user combinations
    __table_args__ = (
        db.UniqueConstraint('project_id', 'user_id', name='unique_project_user'),
    )
    
    def to_dict(self):
        """Serialize project member to dictionary."""
        return {
            'id': self.id,
            'project_id': self.project_id,
            'user_id': self.user_id,
            'permissions': self.permissions,
            'user': self.user.to_dict(include_email=False),
            'joined_at': self.created_at.isoformat()
        }
    
    def __repr__(self):
        return f'<ProjectMember project={self.project_id} user={self.user_id}>'
