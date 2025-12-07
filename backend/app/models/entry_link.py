from datetime import datetime
from app import db

class EntryLink(db.Model):
    """Link between timeline entries to capture investigator insights and relationships."""
    __tablename__ = 'entry_links'
    
    id = db.Column(db.Integer, primary_key=True)
    from_entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id', ondelete='CASCADE'), nullable=False)
    to_entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id', ondelete='CASCADE'), nullable=False)
    link_type = db.Column(db.String(50), nullable=False)  # 'relates_to', 'caused_by', 'leads_to', 'contradicts', 'supports', 'precedes', 'follows'
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    from_entry = db.relationship('TimelineEntry', foreign_keys=[from_entry_id], backref='outgoing_links')
    to_entry = db.relationship('TimelineEntry', foreign_keys=[to_entry_id], backref='incoming_links')
    creator = db.relationship('User', backref='created_entry_links')
    
    def to_dict(self):
        return {
            'id': self.id,
            'from_entry_id': self.from_entry_id,
            'to_entry_id': self.to_entry_id,
            'link_type': self.link_type,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'from_entry': {
                'id': self.from_entry.id,
                'timeline_id': self.from_entry.timeline_id,
                'timeline_name': self.from_entry.timeline.name,
                'data': self.from_entry.data
            } if self.from_entry else None,
            'to_entry': {
                'id': self.to_entry.id,
                'timeline_id': self.to_entry.timeline_id,
                'timeline_name': self.to_entry.timeline.name,
                'data': self.to_entry.data
            } if self.to_entry else None,
            'creator': {
                'id': self.creator.id,
                'full_name': self.creator.full_name,
                'email': self.creator.email
            } if self.creator else None
        }
