"""IOC (Indicator of Compromise) models for tracking and managing threat indicators."""
from app import db
from app.models import TimestampMixin
from datetime import datetime


class IOC(TimestampMixin, db.Model):
    """Indicator of Compromise tracking."""
    __tablename__ = 'iocs'
    
    id = db.Column(db.Integer, primary_key=True)
    
    # Core IOC data
    ioc_type = db.Column(db.String(50), nullable=False, index=True)  # ip, domain, hash, url, email, etc.
    value = db.Column(db.String(500), nullable=False, index=True)
    
    # Context
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id', ondelete='SET NULL'), nullable=True, index=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id', ondelete='SET NULL'), nullable=True, index=True)
    
    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    confidence = db.Column(db.String(20), default='low')  # low, medium, high, confirmed
    severity = db.Column(db.String(20), default='info')  # info, low, medium, high, critical
    status = db.Column(db.String(20), default='active')  # active, investigating, resolved, false_positive
    
    # Additional data
    description = db.Column(db.Text)
    notes = db.Column(db.Text)
    tags = db.Column(db.JSON, default=list)  # List of tags
    source = db.Column(db.String(100))  # manual, auto_extracted, imported, etc.
    
    # Enrichment data (store last enrichment results)
    enrichment_data = db.Column(db.JSON)
    last_enriched_at = db.Column(db.DateTime)
    
    # Timestamps for first/last seen
    first_seen = db.Column(db.DateTime, default=datetime.utcnow)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref='iocs')
    timeline = db.relationship('Timeline', backref='iocs')
    entry = db.relationship('TimelineEntry', backref='iocs')
    creator = db.relationship('User', backref='created_iocs')
    
    # Indexes for efficient querying
    __table_args__ = (
        db.Index('idx_ioc_project_type', 'project_id', 'ioc_type'),
        db.Index('idx_ioc_value_type', 'value', 'ioc_type'),
        db.Index('idx_ioc_status', 'status'),
    )
    
    def to_dict(self, include_enrichment=False):
        """Convert IOC to dictionary."""
        data = {
            'id': self.id,
            'ioc_type': self.ioc_type,
            'value': self.value,
            'project_id': self.project_id,
            'timeline_id': self.timeline_id,
            'entry_id': self.entry_id,
            'created_by': self.created_by,
            'confidence': self.confidence,
            'severity': self.severity,
            'status': self.status,
            'description': self.description,
            'notes': self.notes,
            'tags': self.tags or [],
            'source': self.source,
            'first_seen': self.first_seen.isoformat() if self.first_seen else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'last_enriched_at': self.last_enriched_at.isoformat() if self.last_enriched_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_enrichment and self.enrichment_data:
            data['enrichment_data'] = self.enrichment_data
        
        return data
    
    def update_last_seen(self):
        """Update the last_seen timestamp."""
        self.last_seen = datetime.utcnow()
    
    @staticmethod
    def get_or_create(project_id, ioc_type, value, **kwargs):
        """Get existing IOC or create new one."""
        ioc = IOC.query.filter_by(
            project_id=project_id,
            ioc_type=ioc_type,
            value=value
        ).first()
        
        if ioc:
            # Update last_seen
            ioc.update_last_seen()
            return ioc, False
        
        # Create new IOC
        ioc = IOC(
            project_id=project_id,
            ioc_type=ioc_type,
            value=value,
            **kwargs
        )
        return ioc, True
