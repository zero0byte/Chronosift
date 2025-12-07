from app import db
from app.models import TimestampMixin
from sqlalchemy.dialects.postgresql import JSONB


class Entity(db.Model, TimestampMixin):
    """Entity model for storing enrichable data types from timeline entries."""
    
    __tablename__ = 'entities'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id'), nullable=False)
    entity_type = db.Column(db.String(50), nullable=False)  # ip, hash, domain, url, crypto, email, cert, asn, user_agent, ioc
    value = db.Column(db.String(512), nullable=False, index=True)  # The actual entity value
    context = db.Column(JSONB)  # Additional context about where this entity was found
    
    # Relationships
    timeline_entry = db.relationship('TimelineEntry', back_populates='entities')
    enrichment_results = db.relationship('EnrichmentResult', back_populates='entity', cascade='all, delete-orphan')
    
    # Unique constraint to prevent duplicate entities
    __table_args__ = (
        db.UniqueConstraint('timeline_entry_id', 'entity_type', 'value', name='unique_entity_per_entry'),
    )
    
    def to_dict(self):
        """Serialize entity to dictionary."""
        return {
            'id': self.id,
            'timeline_entry_id': self.timeline_entry_id,
            'entity_type': self.entity_type,
            'value': self.value,
            'context': self.context,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<Entity {self.entity_type}:{self.value}>'


class EnrichmentProvider(db.Model, TimestampMixin):
    """EnrichmentProvider model for defining available enrichment sources."""
    
    __tablename__ = 'enrichment_providers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)  # greynoise, abuseipdb, virustotal, etc.
    entity_type = db.Column(db.String(50), nullable=False)  # What type of entity this enriches
    description = db.Column(db.Text)
    requires_api_key = db.Column(db.Boolean, default=True)
    is_enabled = db.Column(db.Boolean, default=True)
    config = db.Column(JSONB)  # Provider-specific configuration (endpoints, rate limits, etc.)
    
    # Relationships
    enrichment_results = db.relationship('EnrichmentResult', back_populates='provider', cascade='all, delete-orphan')
    
    def to_dict(self):
        """Serialize enrichment provider to dictionary."""
        return {
            'id': self.id,
            'name': self.name,
            'entity_type': self.entity_type,
            'description': self.description,
            'requires_api_key': self.requires_api_key,
            'is_enabled': self.is_enabled,
            'config': self.config,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<EnrichmentProvider {self.name}>'


class EnrichmentResult(db.Model, TimestampMixin):
    """EnrichmentResult model for storing enrichment data."""
    
    __tablename__ = 'enrichment_results'
    
    id = db.Column(db.Integer, primary_key=True)
    entity_id = db.Column(db.Integer, db.ForeignKey('entities.id'), nullable=False)
    provider_id = db.Column(db.Integer, db.ForeignKey('enrichment_providers.id'), nullable=False)
    data = db.Column(JSONB, nullable=False)  # The enrichment data from the provider
    confidence = db.Column(db.Float)  # Confidence score 0.0-1.0
    error = db.Column(db.Text)  # Error message if enrichment failed
    
    # Relationships
    entity = db.relationship('Entity', back_populates='enrichment_results')
    provider = db.relationship('EnrichmentProvider', back_populates='enrichment_results')
    
    def to_dict(self):
        """Serialize enrichment result to dictionary."""
        return {
            'id': self.id,
            'entity_id': self.entity_id,
            'provider_id': self.provider_id,
            'data': self.data,
            'confidence': self.confidence,
            'error': self.error,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def __repr__(self):
        return f'<EnrichmentResult entity_id={self.entity_id} provider_id={self.provider_id}>'


class UserAPIKey(db.Model, TimestampMixin):
    """UserAPIKey model for securely storing user API keys for enrichment providers."""
    
    __tablename__ = 'user_api_keys'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    provider_id = db.Column(db.Integer, db.ForeignKey('enrichment_providers.id'), nullable=False)
    encrypted_key = db.Column(db.Text, nullable=False)  # Encrypted API key
    key_name = db.Column(db.String(100))  # Optional name for the key
    
    # Relationships
    user = db.relationship('User', backref=db.backref('api_keys', lazy='dynamic'))
    provider = db.relationship('EnrichmentProvider', backref=db.backref('user_keys', lazy='dynamic'))
    
    # Unique constraint - one key per user per provider
    __table_args__ = (
        db.UniqueConstraint('user_id', 'provider_id', name='unique_user_provider_key'),
    )
    
    def to_dict(self, include_key=False):
        """Serialize user API key to dictionary."""
        result = {
            'id': self.id,
            'user_id': self.user_id,
            'provider_id': self.provider_id,
            'key_name': self.key_name,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        # Only include encrypted key if explicitly requested
        if include_key:
            result['encrypted_key'] = self.encrypted_key
            
        return result
    
    def __repr__(self):
        return f'<UserAPIKey user_id={self.user_id} provider_id={self.provider_id}>'
