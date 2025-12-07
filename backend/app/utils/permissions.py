from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app import db
from app.models.user import User
from app.models.team import Team, TeamMember
from app.models.project import Project, ProjectMember


def get_current_user():
    """Get the current authenticated user."""
    user_id = get_jwt_identity()
    # JWT identity is stored as string, convert back to int
    return User.query.get(int(user_id))


def require_team_membership(required_role=None):
    """
    Decorator to require team membership.
    
    Args:
        required_role: Optional role requirement ('admin' or 'member')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            team_id = kwargs.get('team_id')
            if not team_id:
                return jsonify({'error': 'Team ID required'}), 400
            
            user = get_current_user()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if user is a member of the team
            membership = TeamMember.query.filter_by(
                team_id=team_id,
                user_id=user.id
            ).first()
            
            if not membership:
                return jsonify({'error': 'Not a member of this team'}), 403
            
            # Check role if specified
            if required_role == 'admin' and membership.role != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_project_permission(required_permission='read'):
    """
    Decorator to require project access.
    
    Args:
        required_permission: 'read', 'write', or 'admin'
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            project_id = kwargs.get('project_id') or kwargs.get('id')
            if not project_id:
                return jsonify({'error': 'Project ID required'}), 400
            
            user = get_current_user()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Get project
            project = Project.query.get(project_id)
            if not project:
                return jsonify({'error': 'Project not found'}), 404
            
            # Check if user has access through project membership
            membership = ProjectMember.query.filter_by(
                project_id=project_id,
                user_id=user.id
            ).first()
            
            if not membership:
                return jsonify({'error': 'No access to this project'}), 403
            
            # Check permission level
            permission_hierarchy = {'read': 0, 'write': 1, 'admin': 2}
            required_level = permission_hierarchy.get(required_permission, 0)
            user_level = permission_hierarchy.get(membership.permissions, 0)
            
            if user_level < required_level:
                return jsonify({'error': f'{required_permission.capitalize()} access required'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def is_team_admin(user_id, team_id):
    """Check if user is a team admin."""
    membership = TeamMember.query.filter_by(
        team_id=team_id,
        user_id=user_id
    ).first()
    return membership and membership.role == 'admin'


def is_project_admin(user_id, project_id):
    """Check if user is a project admin."""
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    return membership and membership.permissions == 'admin'


def can_access_project(user_id, project_id):
    """Check if user has any access to project."""
    membership = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    return membership is not None
