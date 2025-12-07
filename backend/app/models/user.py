from app import db
from app.models import TimestampMixin
import bcrypt


class User(db.Model, TimestampMixin):
    """User model for authentication and authorization."""
    
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    is_admin = db.Column(db.Boolean, default=False, nullable=False)
    
    # Relationships
    team_memberships = db.relationship('TeamMember', back_populates='user', cascade='all, delete-orphan')
    project_memberships = db.relationship('ProjectMember', back_populates='user', cascade='all, delete-orphan')
    created_projects = db.relationship('Project', foreign_keys='Project.created_by', back_populates='creator')
    created_timelines = db.relationship('Timeline', foreign_keys='Timeline.created_by', back_populates='creator')
    created_transforms = db.relationship('Transform', back_populates='creator')
    timeline_entries = db.relationship('TimelineEntry', back_populates='creator')
    comments = db.relationship('Comment', back_populates='user', cascade='all, delete-orphan')
    mentions = db.relationship('CommentMention', foreign_keys='CommentMention.mentioned_user_id', back_populates='mentioned_user')
    activities = db.relationship('Activity', back_populates='user')
    
    def set_password(self, password):
        """Hash and set the user's password."""
        self.password_hash = bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt()
        ).decode('utf-8')
    
    def check_password(self, password):
        """Verify the provided password against the stored hash."""
        return bcrypt.checkpw(
            password.encode('utf-8'),
            self.password_hash.encode('utf-8')
        )
    
    @property
    def full_name(self):
        """Return the user's full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.email
    
    def to_dict(self, include_email=True):
        """Serialize user to dictionary."""
        data = {
            'id': self.id,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'full_name': self.full_name,
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_email:
            data['email'] = self.email
        return data
    
    def __repr__(self):
        return f'<User {self.email}>'
