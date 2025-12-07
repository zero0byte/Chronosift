from app import db
from app.models import TimestampMixin


class Comment(db.Model, TimestampMixin):
    """Comment model for timeline entries with @mention support."""
    
    __tablename__ = 'comments'
    
    id = db.Column(db.Integer, primary_key=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)  # For threaded replies
    is_edited = db.Column(db.Boolean, default=False)
    
    # Relationships
    entry = db.relationship('TimelineEntry', back_populates='comments')
    user = db.relationship('User', back_populates='comments')
    mentions = db.relationship('CommentMention', back_populates='comment', cascade='all, delete-orphan')
    parent = db.relationship('Comment', remote_side=[id], back_populates='replies')
    replies = db.relationship('Comment', back_populates='parent', cascade='all, delete-orphan')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_comments_entry_id', 'entry_id'),
        db.Index('idx_comments_user_id', 'user_id'),
        db.Index('idx_comments_parent_id', 'parent_id'),
    )
    
    def to_dict(self, include_replies=False):
        """Serialize comment to dictionary."""
        data = {
            'id': self.id,
            'entry_id': self.entry_id,
            'user_id': self.user_id,
            'user': self.user.to_dict(include_email=False),
            'content': self.content,
            'parent_id': self.parent_id,
            'is_edited': self.is_edited,
            'mentions': [m.to_dict() for m in self.mentions],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_replies:
            data['replies'] = [reply.to_dict(include_replies=False) for reply in self.replies]
        return data
    
    def __repr__(self):
        return f'<Comment {self.id} by User {self.user_id}>'


class CommentMention(db.Model, TimestampMixin):
    """Tracks user mentions in comments for notifications."""
    
    __tablename__ = 'comment_mentions'
    
    id = db.Column(db.Integer, primary_key=True)
    comment_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=False)
    mentioned_user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    
    # Relationships
    comment = db.relationship('Comment', back_populates='mentions')
    mentioned_user = db.relationship('User', back_populates='mentions')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_mentions_user_id', 'mentioned_user_id'),
        db.Index('idx_mentions_comment_id', 'comment_id'),
    )
    
    def to_dict(self):
        """Serialize mention to dictionary."""
        return {
            'id': self.id,
            'comment_id': self.comment_id,
            'mentioned_user_id': self.mentioned_user_id,
            'mentioned_user': self.mentioned_user.to_dict(include_email=False),
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
            'comment': {
                'id': self.comment.id,
                'content': self.comment.content,
                'entry_id': self.comment.entry_id,
                'timeline_id': self.comment.entry.timeline_id if self.comment.entry else None,
                'user': self.comment.user.to_dict(include_email=False)
            } if self.comment else None
        }
    
    def __repr__(self):
        return f'<CommentMention {self.id} User {self.mentioned_user_id}>'
