from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Activity, Project, ProjectMember

bp = Blueprint('activities', __name__, url_prefix='/activities')


@bp.route('/project/<int:project_id>', methods=['GET'])
@jwt_required()
def get_project_activities(project_id):
    """Get activity feed for a project."""
    current_user_id = int(get_jwt_identity())
    
    # Verify user has access to the project
    project = Project.query.get_or_404(project_id)
    is_member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=current_user_id
    ).first()
    
    if not is_member and project.created_by != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    activity_type = request.args.get('type')  # Filter by type if provided
    
    query = Activity.query.filter_by(project_id=project_id)
    
    if activity_type:
        query = query.filter_by(activity_type=activity_type)
    
    activities = query.order_by(Activity.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'activities': [activity.to_dict() for activity in activities.items],
        'total': activities.total,
        'page': page,
        'per_page': per_page,
        'pages': activities.pages
    })


@bp.route('/user', methods=['GET'])
@jwt_required()
def get_user_activities():
    """Get activity feed for the current user across all their projects."""
    current_user_id = int(get_jwt_identity())
    
    # Get all project IDs the user has access to
    memberships = ProjectMember.query.filter_by(user_id=current_user_id).all()
    project_ids = [m.project_id for m in memberships]
    
    # Also include projects created by the user
    created_projects = Project.query.filter_by(created_by=current_user_id).all()
    project_ids.extend([p.id for p in created_projects])
    project_ids = list(set(project_ids))  # Remove duplicates
    
    # Query parameters
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    activity_type = request.args.get('type')
    
    query = Activity.query.filter(Activity.project_id.in_(project_ids))
    
    if activity_type:
        query = query.filter_by(activity_type=activity_type)
    
    activities = query.order_by(Activity.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'activities': [activity.to_dict() for activity in activities.items],
        'total': activities.total,
        'page': page,
        'per_page': per_page,
        'pages': activities.pages
    })
