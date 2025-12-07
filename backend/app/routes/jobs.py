"""
Job management API endpoints for monitoring and controlling async tasks
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.job import Job
from app.models.user import User
from app.celery_app import celery
from celery.result import AsyncResult

bp = Blueprint('jobs', __name__, url_prefix='/api/jobs')


@bp.route('', methods=['GET'])
@jwt_required()
def list_jobs():
    """List all jobs with optional filtering"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    # Query parameters
    status = request.args.get('status')  # pending, running, success, failed, cancelled
    task_type = request.args.get('task_type')  # llm_analysis, file_upload, etc.
    timeline_id = request.args.get('timeline_id', type=int)
    project_id = request.args.get('project_id', type=int)
    user_id = request.args.get('user_id', type=int)
    limit = request.args.get('limit', 50, type=int)
    
    # Base query
    query = Job.query
    
    # Filter by user for non-admins
    if not user.is_admin:
        query = query.filter_by(user_id=current_user_id)
    elif user_id:
        query = query.filter_by(user_id=user_id)
    
    # Apply filters
    if status:
        query = query.filter_by(status=status)
    if task_type:
        query = query.filter_by(task_type=task_type)
    if timeline_id:
        query = query.filter_by(timeline_id=timeline_id)
    if project_id:
        query = query.filter_by(project_id=project_id)
    
    # Get results
    jobs = query.order_by(Job.created_at.desc()).limit(limit).all()
    
    return jsonify({
        'jobs': [job.to_dict() for job in jobs],
        'total': query.count()
    }), 200


@bp.route('/<int:job_id>', methods=['GET'])
@jwt_required()
def get_job(job_id):
    """Get detailed job information"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    # Check permissions
    if not user.is_admin and job.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({'job': job.to_dict(include_details=True)}), 200


@bp.route('/<int:job_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_job(job_id):
    """Cancel a running job"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    # Check permissions
    if not user.is_admin and job.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if job.status not in ['pending', 'running']:
        return jsonify({'error': f'Cannot cancel job with status: {job.status}'}), 400
    
    try:
        # Revoke the Celery task
        celery.control.revoke(job.task_id, terminate=True, signal='SIGKILL')
        
        # Mark job as cancelled
        job.mark_cancelled()
        
        return jsonify({
            'message': 'Job cancelled successfully',
            'job': job.to_dict()
        }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to cancel job: {str(e)}'}), 500


@bp.route('/<int:job_id>/retry', methods=['POST'])
@jwt_required()
def retry_job(job_id):
    """Retry a failed job"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    # Check permissions
    if not user.is_admin and job.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if job.status != 'failed':
        return jsonify({'error': f'Can only retry failed jobs, current status: {job.status}'}), 400
    
    try:
        # Get the original task and parameters
        if job.task_type == 'llm_analysis':
            from app.tasks.llm_analysis_tasks import analyze_timeline_batch_task
            
            # Create new job
            new_job = Job(
                task_id='',  # Will be set after task creation
                task_type=job.task_type,
                name=job.name,
                description=job.description,
                input_data=job.input_data,
                user_id=job.user_id,
                timeline_id=job.timeline_id,
                project_id=job.project_id
            )
            db.session.add(new_job)
            db.session.flush()  # Get the ID
            
            # Start new task
            task = analyze_timeline_batch_task.delay(
                timeline_id=job.timeline_id,
                job_id=new_job.id,
                **job.input_data
            )
            
            # Update new job with task ID
            new_job.task_id = task.id
            db.session.commit()
            
            return jsonify({
                'message': 'Job retried successfully',
                'job': new_job.to_dict()
            }), 200
        else:
            return jsonify({'error': f'Retry not supported for task type: {job.task_type}'}), 400
            
    except Exception as e:
        return jsonify({'error': f'Failed to retry job: {str(e)}'}), 500


@bp.route('/stats', methods=['GET'])
@jwt_required()
def get_job_stats():
    """Get job statistics"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    # Base query
    query = Job.query
    if not user.is_admin:
        query = query.filter_by(user_id=current_user_id)
    
    # Count by status
    stats = {
        'pending': query.filter_by(status='pending').count(),
        'running': query.filter_by(status='running').count(),
        'success': query.filter_by(status='success').count(),
        'failed': query.filter_by(status='failed').count(),
        'cancelled': query.filter_by(status='cancelled').count(),
        'total': query.count()
    }
    
    # Recent jobs
    recent_jobs = query.order_by(Job.created_at.desc()).limit(10).all()
    
    return jsonify({
        'stats': stats,
        'recent_jobs': [job.to_dict() for job in recent_jobs]
    }), 200


@bp.route('/active', methods=['GET'])
@jwt_required()
def get_active_jobs():
    """Get all currently active (pending/running) jobs"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    query = Job.query.filter(Job.status.in_(['pending', 'running']))
    
    if not user.is_admin:
        query = query.filter_by(user_id=current_user_id)
    
    jobs = query.order_by(Job.created_at.desc()).all()
    
    return jsonify({
        'jobs': [job.to_dict() for job in jobs]
    }), 200


@bp.route('/<int:job_id>', methods=['DELETE'])
@jwt_required()
def delete_job(job_id):
    """Delete a specific job"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    # Check permissions
    if not user.is_admin and job.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Don't allow deletion of active jobs
    if job.status in ['pending', 'running']:
        return jsonify({'error': 'Cannot delete active jobs. Please cancel them first.'}), 400
    
    try:
        db.session.delete(job)
        db.session.commit()
        return jsonify({'message': 'Job deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete job: {str(e)}'}), 500


@bp.route('/delete-all', methods=['DELETE'])
@jwt_required()
def delete_all_jobs():
    """Delete all completed jobs (success, failed, cancelled)"""
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    # Query parameters for filtering what to delete
    status = request.args.get('status')  # Optional: specific status to delete
    task_type = request.args.get('task_type')  # Optional: specific task type
    
    # Base query - only completed jobs
    query = Job.query.filter(Job.status.in_(['success', 'failed', 'cancelled']))
    
    # Filter by user for non-admins
    if not user.is_admin:
        query = query.filter_by(user_id=current_user_id)
    
    # Apply optional filters
    if status and status in ['success', 'failed', 'cancelled']:
        query = query.filter_by(status=status)
    if task_type:
        query = query.filter_by(task_type=task_type)
    
    try:
        jobs_to_delete = query.all()
        count = len(jobs_to_delete)
        
        for job in jobs_to_delete:
            db.session.delete(job)
        
        db.session.commit()
        
        return jsonify({
            'message': f'Successfully deleted {count} job(s)',
            'deleted_count': count
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete jobs: {str(e)}'}), 500
