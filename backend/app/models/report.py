"""Report and ReportTemplate models for custom report generation."""
from app import db
from app.models import TimestampMixin
from datetime import datetime


class ReportTemplate(TimestampMixin, db.Model):
    """Report template with customizable content and formatting."""
    __tablename__ = 'report_templates'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Template content (HTML with Jinja2 placeholders)
    template_content = db.Column(db.Text, nullable=False)
    
    # Template configuration
    config = db.Column(db.JSON, default=dict)  # Page size, orientation, margins, etc.
    
    # Categorization
    is_public = db.Column(db.Boolean, default=False)  # Shared with all project members
    category = db.Column(db.String(100))  # e.g., "Timeline Summary", "Executive Report", etc.
    
    # Relationships
    project = db.relationship('Project', backref='report_templates')
    creator = db.relationship('User', backref='created_report_templates')
    reports = db.relationship('Report', back_populates='template', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'project_id': self.project_id,
            'created_by': self.created_by,
            'template_content': self.template_content,
            'config': self.config or {},
            'is_public': self.is_public,
            'category': self.category,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Report(TimestampMixin, db.Model):
    """Generated report instance."""
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    
    # Template used
    template_id = db.Column(db.Integer, db.ForeignKey('report_templates.id', ondelete='SET NULL'), nullable=True)
    
    # Associated entities
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id', ondelete='SET NULL'), nullable=True)
    
    # Creator
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Report parameters (filters, date range, etc.)
    parameters = db.Column(db.JSON, default=dict)
    
    # Generated content
    html_content = db.Column(db.Text)  # Rendered HTML
    pdf_path = db.Column(db.String(500))  # Path to generated PDF file (deprecated, use file_path)
    file_path = db.Column(db.String(500))  # Path to generated file (PDF or DOCX)
    format = db.Column(db.String(10), default='pdf')  # 'pdf' or 'docx'
    
    # Metadata
    entry_count = db.Column(db.Integer, default=0)
    file_size = db.Column(db.Integer)  # Size in bytes
    generation_time = db.Column(db.Float)  # Time taken to generate in seconds
    
    # Relationships
    template = db.relationship('ReportTemplate', back_populates='reports')
    project = db.relationship('Project', backref='reports')
    timeline = db.relationship('Timeline', backref='reports')
    creator = db.relationship('User', backref='generated_reports')
    
    def to_dict(self, include_content=False):
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'template_id': self.template_id,
            'project_id': self.project_id,
            'timeline_id': self.timeline_id,
            'created_by': self.created_by,
            'parameters': self.parameters or {},
            'entry_count': self.entry_count,
            'file_size': self.file_size,
            'generation_time': self.generation_time,
            'pdf_path': self.pdf_path,  # Deprecated, kept for backwards compatibility
            'file_path': self.file_path or self.pdf_path,  # New unified field
            'format': self.format or 'pdf',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        
        if include_content:
            data['html_content'] = self.html_content
        
        return data
