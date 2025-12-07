"""
MITRE ATT&CK Framework models for storing tactics, techniques, and mappings
"""
from app import db
from datetime import datetime


class MitreTactic(db.Model):
    """MITRE ATT&CK Tactic (e.g., Initial Access, Persistence)"""
    __tablename__ = 'mitre_tactics'
    
    id = db.Column(db.String(50), primary_key=True)  # e.g., "TA0001"
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    url = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    techniques = db.relationship('MitreTechnique', back_populates='tactic', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'url': self.url
        }


class MitreTechnique(db.Model):
    """MITRE ATT&CK Technique (e.g., T1566 - Phishing)"""
    __tablename__ = 'mitre_techniques'
    
    id = db.Column(db.String(50), primary_key=True)  # e.g., "T1566"
    tactic_id = db.Column(db.String(50), db.ForeignKey('mitre_tactics.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    detection = db.Column(db.Text)
    platforms = db.Column(db.JSON)  # List of platforms
    data_sources = db.Column(db.JSON)  # List of data sources
    url = db.Column(db.String(500))
    is_subtechnique = db.Column(db.Boolean, default=False)
    parent_technique_id = db.Column(db.String(50), db.ForeignKey('mitre_techniques.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tactic = db.relationship('MitreTactic', back_populates='techniques')
    parent_technique = db.relationship('MitreTechnique', remote_side=[id], backref='subtechniques')
    
    def to_dict(self, include_subtechniques=False):
        result = {
            'id': self.id,
            'tactic_id': self.tactic_id,
            'name': self.name,
            'description': self.description,
            'detection': self.detection,
            'platforms': self.platforms,
            'data_sources': self.data_sources,
            'url': self.url,
            'is_subtechnique': self.is_subtechnique,
            'parent_technique_id': self.parent_technique_id
        }
        
        if include_subtechniques and not self.is_subtechnique:
            result['subtechniques'] = [st.to_dict() for st in self.subtechniques]
        
        return result


class TimelineAnalysisResult(db.Model):
    """Stores LLM analysis results for timeline entries"""
    __tablename__ = 'timeline_analysis_results'
    
    id = db.Column(db.Integer, primary_key=True)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id', ondelete='CASCADE'), nullable=False)
    entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id', ondelete='CASCADE'), nullable=True)
    analysis_type = db.Column(db.String(50), nullable=False)  # 'prioritization', 'attack_mapping', 'chain_detection'
    
    # Analysis results
    priority_score = db.Column(db.Float)  # 0-1 relevance/severity score
    confidence_score = db.Column(db.Float)  # 0-1 confidence in analysis
    mitre_technique_id = db.Column(db.String(50), db.ForeignKey('mitre_techniques.id'), nullable=True)
    mitre_tactic_id = db.Column(db.String(50), db.ForeignKey('mitre_tactics.id'), nullable=True)
    
    # LLM metadata
    llm_provider = db.Column(db.String(50))  # 'openai', 'anthropic', 'local'
    llm_model = db.Column(db.String(100))
    prompt_tokens = db.Column(db.Integer)
    completion_tokens = db.Column(db.Integer)
    
    # Explanation and reasoning
    explanation = db.Column(db.Text)  # Human-readable explanation
    raw_response = db.Column(db.JSON)  # Full LLM response
    
    # Metadata
    analyzed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    timeline = db.relationship('Timeline', backref=db.backref('analysis_results', cascade='all, delete-orphan', passive_deletes=True))
    entry = db.relationship('TimelineEntry', backref=db.backref('analysis_results', cascade='all, delete-orphan', passive_deletes=True))
    mitre_technique = db.relationship('MitreTechnique')
    mitre_tactic = db.relationship('MitreTactic')
    analyzer = db.relationship('User')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_analysis_timeline_id', 'timeline_id'),
        db.Index('idx_analysis_entry_id', 'entry_id'),
        db.Index('idx_analysis_technique_id', 'mitre_technique_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'timeline_id': self.timeline_id,
            'entry_id': self.entry_id,
            'analysis_type': self.analysis_type,
            'priority_score': self.priority_score,
            'confidence_score': self.confidence_score,
            'mitre_technique': self.mitre_technique.to_dict() if self.mitre_technique else None,
            'mitre_tactic': self.mitre_tactic.to_dict() if self.mitre_tactic else None,
            'llm_provider': self.llm_provider,
            'llm_model': self.llm_model,
            'explanation': self.explanation,
            'analyzed_by': self.analyzed_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class TrainingDataset(db.Model):
    """Manages training datasets built from analyzed timelines"""
    __tablename__ = 'training_datasets'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    version = db.Column(db.String(50))
    
    # Dataset metadata
    total_examples = db.Column(db.Integer, default=0)
    source_timelines = db.Column(db.JSON)  # List of timeline IDs
    dataset_format = db.Column(db.String(50), default='jsonl')  # 'jsonl', 'csv', 'parquet'
    file_path = db.Column(db.String(500))  # Path to exported dataset file
    
    # Quality metrics
    validated_examples = db.Column(db.Integer, default=0)
    avg_confidence_score = db.Column(db.Float)
    
    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = db.relationship('User', backref='training_datasets')
    examples = db.relationship('TrainingExample', back_populates='dataset', lazy='dynamic', 
                               cascade='all, delete-orphan')
    
    def to_dict(self, include_examples=False):
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'version': self.version,
            'total_examples': self.total_examples,
            'source_timelines': self.source_timelines,
            'dataset_format': self.dataset_format,
            'file_path': self.file_path,
            'validated_examples': self.validated_examples,
            'avg_confidence_score': self.avg_confidence_score,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_examples:
            result['examples'] = [ex.to_dict() for ex in self.examples.all()]
        
        return result


class TrainingExample(db.Model):
    """Individual training examples for LLM fine-tuning"""
    __tablename__ = 'training_examples'
    
    id = db.Column(db.Integer, primary_key=True)
    dataset_id = db.Column(db.Integer, db.ForeignKey('training_datasets.id', ondelete='CASCADE'), nullable=False)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id', ondelete='SET NULL'), nullable=True)
    entry_id = db.Column(db.Integer, db.ForeignKey('timeline_entries.id', ondelete='SET NULL'), nullable=True)
    
    # Training data
    input_text = db.Column(db.Text, nullable=False)  # Event description/context
    output_text = db.Column(db.Text, nullable=False)  # Expected analysis result
    
    # Labels and annotations
    mitre_technique_id = db.Column(db.String(50), db.ForeignKey('mitre_techniques.id'), nullable=True)
    mitre_tactic_id = db.Column(db.String(50), db.ForeignKey('mitre_tactics.id'), nullable=True)
    priority_score = db.Column(db.Float)
    
    # Validation
    is_validated = db.Column(db.Boolean, default=False)
    validated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    validation_notes = db.Column(db.Text)
    confidence_score = db.Column(db.Float)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = db.relationship('TrainingDataset', back_populates='examples')
    timeline = db.relationship('Timeline')
    entry = db.relationship('TimelineEntry')
    mitre_technique = db.relationship('MitreTechnique')
    mitre_tactic = db.relationship('MitreTactic')
    validator = db.relationship('User')
    
    # Indexes
    __table_args__ = (
        db.Index('idx_training_dataset_id', 'dataset_id'),
        db.Index('idx_training_validated', 'is_validated'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'dataset_id': self.dataset_id,
            'timeline_id': self.timeline_id,
            'entry_id': self.entry_id,
            'input_text': self.input_text,
            'output_text': self.output_text,
            'mitre_technique': self.mitre_technique.to_dict() if self.mitre_technique else None,
            'mitre_tactic': self.mitre_tactic.to_dict() if self.mitre_tactic else None,
            'priority_score': self.priority_score,
            'is_validated': self.is_validated,
            'validated_by': self.validated_by,
            'validation_notes': self.validation_notes,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
