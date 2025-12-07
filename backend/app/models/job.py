"""
Job/Task tracking models for async operations
"""
from app import db
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON


class Job(db.Model):
    """Track async job/task execution"""
    __tablename__ = 'jobs'
    
    id = db.Column(db.Integer, primary_key=True)
    task_id = db.Column(db.String(255), unique=True, nullable=False, index=True)  # Celery task ID
    task_type = db.Column(db.String(100), nullable=False, index=True)  # e.g., 'llm_analysis', 'file_upload'
    status = db.Column(
        db.String(50), 
        nullable=False, 
        default='pending',
        index=True
    )  # pending, running, success, failed, cancelled
    
    # Job metadata
    name = db.Column(db.String(255))  # Human-readable name
    description = db.Column(db.Text)
    
    # Progress tracking
    progress = db.Column(db.Float, default=0.0)  # 0.0 to 100.0
    current_step = db.Column(db.String(255))
    total_steps = db.Column(db.Integer)
    
    # Input/output data
    input_data = db.Column(JSON)  # Parameters passed to task
    result_data = db.Column(JSON)  # Task result
    error_message = db.Column(db.Text)
    error_traceback = db.Column(db.Text)
    
    # Resource references
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    timeline_id = db.Column(db.Integer, db.ForeignKey('timelines.id'), nullable=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    
    # Timing
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    user = db.relationship('User', backref='jobs')
    timeline = db.relationship('Timeline', backref='jobs', foreign_keys=[timeline_id])
    project = db.relationship('Project', backref='jobs', foreign_keys=[project_id])
    
    def __repr__(self):
        return f'<Job {self.id} ({self.task_type}): {self.status}>'
    
    def to_dict(self, include_details=False):
        """Convert job to dictionary"""
        data = {
            'id': self.id,
            'task_id': self.task_id,
            'task_type': self.task_type,
            'status': self.status,
            'name': self.name,
            'description': self.description,
            'progress': self.progress,
            'current_step': self.current_step,
            'total_steps': self.total_steps,
            'user_id': self.user_id,
            'timeline_id': self.timeline_id,
            'project_id': self.project_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }
        
        if include_details:
            data.update({
                'input_data': self.input_data,
                'result_data': self.result_data,
                'error_message': self.error_message,
            })
        
        # Calculate duration if applicable
        if self.started_at and self.completed_at:
            duration = (self.completed_at - self.started_at).total_seconds()
            data['duration_seconds'] = duration
        elif self.started_at:
            duration = (datetime.utcnow() - self.started_at).total_seconds()
            data['running_seconds'] = duration
        
        return data
    
    def update_progress(self, progress, current_step=None):
        """Update job progress"""
        self.progress = min(100.0, max(0.0, progress))
        if current_step:
            self.current_step = current_step
        db.session.commit()
    
    def mark_started(self):
        """Mark job as started"""
        self.status = 'running'
        self.started_at = datetime.utcnow()
        db.session.commit()
    
    def mark_success(self, result_data=None):
        """Mark job as successfully completed"""
        self.status = 'success'
        self.progress = 100.0
        self.completed_at = datetime.utcnow()
        if result_data:
            self.result_data = result_data
        db.session.commit()
    
    def mark_failed(self, error_message, error_traceback=None):
        """Mark job as failed"""
        self.status = 'failed'
        self.completed_at = datetime.utcnow()
        self.error_message = error_message
        self.error_traceback = error_traceback
        db.session.commit()
    
    def mark_cancelled(self):
        """Mark job as cancelled"""
        self.status = 'cancelled'
        self.completed_at = datetime.utcnow()
        db.session.commit()
