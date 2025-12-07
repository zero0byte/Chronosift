from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, and_, cast, String
from datetime import datetime
from app import db
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.project import Project, ProjectMember
from app.models.timeline import Timeline, TimelineEntry
from app.utils.permissions import require_project_permission, require_team_membership

bp = Blueprint('projects', __name__)


@bp.route('/', methods=['POST'])
@jwt_required()
def create_project():
    """Create a new project within a team."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Project name is required'}), 400
    if not data.get('team_id'):
        return jsonify({'error': 'Team ID is required'}), 400
    
    team_id = data['team_id']
    
    # Check if user is a member of the team
    membership = TeamMember.query.filter_by(
        team_id=team_id,
        user_id=current_user_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Not a member of this team'}), 403
    
    # Create project
    project = Project(
        name=data['name'],
        description=data.get('description'),
        team_id=team_id,
        created_by=current_user_id,
        status=data.get('status', 'active')
    )
    db.session.add(project)
    db.session.flush()  # Get project ID
    
    # Add creator as admin
    project_member = ProjectMember(
        project_id=project.id,
        user_id=current_user_id,
        permissions='admin'
    )
    db.session.add(project_member)
    db.session.commit()
    
    return jsonify({
        'message': 'Project created successfully',
        'project': project.to_dict(include_members=True)
    }), 201


@bp.route('/', methods=['GET'])
@jwt_required()
def list_projects():
    """List all projects the user has access to."""
    current_user_id = get_jwt_identity()
    team_id = request.args.get('team_id', type=int)
    
    # Get user's project memberships
    query = ProjectMember.query.filter_by(user_id=current_user_id)
    
    if team_id:
        # Filter by team if specified
        query = query.join(Project).filter(Project.team_id == team_id)
    
    memberships = query.all()
    projects = [membership.project.to_dict() for membership in memberships]
    
    return jsonify({
        'projects': projects
    }), 200


@bp.route('/<int:project_id>', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def get_project(project_id):
    """Get project details by ID."""
    project = Project.query.get_or_404(project_id)
    
    # Include timelines count
    data = project.to_dict(include_members=True)
    data['timeline_count'] = len(project.timelines)
    
    return jsonify({
        'project': data
    }), 200


@bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required()
@require_project_permission('admin')
def update_project(project_id):
    """Update project information."""
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        project.name = data['name']
    if 'description' in data:
        project.description = data['description']
    if 'status' in data:
        project.status = data['status']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Project updated successfully',
        'project': project.to_dict()
    }), 200


@bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required()
@require_project_permission('admin')
def delete_project(project_id):
    """Delete a project."""
    project = Project.query.get_or_404(project_id)
    db.session.delete(project)
    db.session.commit()
    
    return jsonify({
        'message': 'Project deleted successfully'
    }), 200


# Project Member Management

@bp.route('/<int:project_id>/members', methods=['POST'])
@jwt_required()
@require_project_permission('admin')
def add_project_member(project_id):
    """Add a member to the project."""
    data = request.get_json()
    
    # Validate required fields
    if not data.get('user_id'):
        return jsonify({'error': 'User ID is required'}), 400
    
    user_id = data['user_id']
    permissions = data.get('permissions', 'read')
    
    # Check if user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if user is a member of the project's team
    project = Project.query.get(project_id)
    team_membership = TeamMember.query.filter_by(
        team_id=project.team_id,
        user_id=user_id
    ).first()
    
    if not team_membership:
        return jsonify({'error': 'User must be a team member first'}), 400
    
    # Check if already a project member
    existing = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    
    if existing:
        return jsonify({'error': 'User is already a project member'}), 409
    
    # Add member
    project_member = ProjectMember(
        project_id=project_id,
        user_id=user_id,
        permissions=permissions
    )
    db.session.add(project_member)
    db.session.commit()
    
    return jsonify({
        'message': 'Project member added successfully',
        'member': project_member.to_dict()
    }), 201


@bp.route('/<int:project_id>/members/<int:user_id>', methods=['PUT'])
@jwt_required()
@require_project_permission('admin')
def update_project_member(project_id, user_id):
    """Update a project member's permissions."""
    data = request.get_json()
    
    member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first_or_404()
    
    if 'permissions' in data:
        member.permissions = data['permissions']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Project member updated successfully',
        'member': member.to_dict()
    }), 200


@bp.route('/<int:project_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_project_permission('admin')
def remove_project_member(project_id, user_id):
    """Remove a member from the project."""
    current_user_id = get_jwt_identity()
    
    # Prevent removing yourself if you're the last admin
    if current_user_id == user_id:
        admin_count = ProjectMember.query.filter_by(
            project_id=project_id,
            permissions='admin'
        ).count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot remove the last admin'}), 400
    
    member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first_or_404()
    
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({
        'message': 'Project member removed successfully'
    }), 200


@bp.route('/<int:project_id>/timelines', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def list_project_timelines(project_id):
    """List all timelines in a project."""
    project = Project.query.get_or_404(project_id)
    
    timelines = [timeline.to_dict() for timeline in project.timelines]
    
    return jsonify({
        'timelines': timelines
    }), 200


@bp.route('/<int:project_id>/search', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def search_project(project_id):
    """Search across all timelines in a project."""
    project = Project.query.get_or_404(project_id)
    
    # Get search parameters
    keyword = request.args.get('keyword', '').strip()
    start_date = request.args.get('start_date')  # ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    end_date = request.args.get('end_date')
    
    # Handle timeline_ids - axios might send as array brackets or repeated params
    timeline_ids = []
    # Try getting as list (repeated params like ?timeline_ids=1&timeline_ids=2)
    timeline_ids_list = request.args.getlist('timeline_ids')
    if timeline_ids_list:
        timeline_ids = [int(tid) for tid in timeline_ids_list if tid.isdigit()]
    # Also try with brackets (like ?timeline_ids[]=1&timeline_ids[]=2)
    elif 'timeline_ids[]' in request.args:
        timeline_ids_list = request.args.getlist('timeline_ids[]')
        timeline_ids = [int(tid) for tid in timeline_ids_list if tid.isdigit()]
    
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)
    
    # Start with all entries from project timelines
    query = TimelineEntry.query.join(Timeline).filter(Timeline.project_id == project_id)
    
    # Filter by specific timelines if requested
    if timeline_ids:
        query = query.filter(Timeline.id.in_(timeline_ids))
    
    # Apply date range filter if provided
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            # Search for timestamp in the data JSON field
            # We need to extract timestamps from various possible column names
            query = query.filter(
                or_(
                    cast(TimelineEntry.data['Timestamp'].astext, String) >= start_date,
                    cast(TimelineEntry.data['TimeCreated'].astext, String) >= start_date,
                    cast(TimelineEntry.data['Created0x10'].astext, String) >= start_date,
                    cast(TimelineEntry.data['LastModified'].astext, String) >= start_date,
                    cast(TimelineEntry.data['TargetModified'].astext, String) >= start_date,
                    cast(TimelineEntry.data['LastWriteTimestamp'].astext, String) >= start_date
                )
            )
        except ValueError:
            return jsonify({'error': 'Invalid start_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)'}), 400
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(
                or_(
                    cast(TimelineEntry.data['Timestamp'].astext, String) <= end_date,
                    cast(TimelineEntry.data['TimeCreated'].astext, String) <= end_date,
                    cast(TimelineEntry.data['Created0x10'].astext, String) <= end_date,
                    cast(TimelineEntry.data['LastModified'].astext, String) <= end_date,
                    cast(TimelineEntry.data['TargetModified'].astext, String) <= end_date,
                    cast(TimelineEntry.data['LastWriteTimestamp'].astext, String) <= end_date
                )
            )
        except ValueError:
            return jsonify({'error': 'Invalid end_date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)'}), 400
    
    # Apply keyword search if provided
    if keyword:
        # Search in JSON data field (case-insensitive)
        search_pattern = f'%{keyword}%'
        query = query.filter(
            cast(TimelineEntry.data, String).ilike(search_pattern)
        )
    
    # Get total count before pagination
    total_count = query.count()
    
    # Apply pagination and fetch results
    entries = query.order_by(TimelineEntry.id.desc()).limit(limit).offset(offset).all()
    
    # Format results with timeline information
    results = []
    for entry in entries:
        entry_dict = entry.to_dict()
        entry_dict['timeline'] = {
            'id': entry.timeline.id,
            'name': entry.timeline.name,
            'is_master': entry.timeline.is_master
        }
        results.append(entry_dict)
    
    return jsonify({
        'results': results,
        'total': total_count,
        'limit': limit,
        'offset': offset,
        'has_more': (offset + len(results)) < total_count
    }), 200
