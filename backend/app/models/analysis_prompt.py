"""
Database model for LLM analysis prompts
"""
from app import db
from datetime import datetime


class AnalysisPrompt(db.Model):
    """Model for storing customizable LLM analysis prompts"""
    __tablename__ = 'analysis_prompts'
    
    id = db.Column(db.Integer, primary_key=True)
    prompt_type = db.Column(db.String(50), nullable=False, index=True)  # 'priority', 'attack', 'chains'
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    system_prompt = db.Column(db.Text, nullable=False)
    user_prompt_template = db.Column(db.Text)  # Optional template for user prompt with placeholders
    is_default = db.Column(db.Boolean, default=False)  # System default prompts
    is_active = db.Column(db.Boolean, default=True)  # Whether this prompt is currently in use
    version = db.Column(db.Integer, default=1)
    
    # Metadata
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    creator = db.relationship('User', backref='analysis_prompts', foreign_keys=[created_by])
    
    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'prompt_type': self.prompt_type,
            'name': self.name,
            'description': self.description,
            'system_prompt': self.system_prompt,
            'user_prompt_template': self.user_prompt_template,
            'is_default': self.is_default,
            'is_active': self.is_active,
            'version': self.version,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    @staticmethod
    def get_active_prompt(prompt_type: str):
        """Get the active prompt for a given type"""
        return AnalysisPrompt.query.filter_by(
            prompt_type=prompt_type,
            is_active=True
        ).order_by(
            AnalysisPrompt.is_default.desc(),  # Prefer non-default (custom) prompts
            AnalysisPrompt.updated_at.desc()
        ).first()
    
    @staticmethod
    def get_default_prompt(prompt_type: str):
        """Get the default system prompt for a given type"""
        return AnalysisPrompt.query.filter_by(
            prompt_type=prompt_type,
            is_default=True
        ).first()
