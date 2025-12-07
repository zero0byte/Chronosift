from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User
from app.models.team import Team, TeamMember
from app.utils.permissions import require_team_membership, is_team_admin

bp = Blueprint('teams', __name__)


@bp.route('/', methods=['POST'])
@jwt_required()
def create_team():
    """Create a new team."""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Team name is required'}), 400
    
    # Create team
    team = Team(
        name=data['name'],
        description=data.get('description'),
        created_by=current_user_id
    )
    db.session.add(team)
    db.session.flush()  # Get team ID
    
    # Add creator as admin
    team_member = TeamMember(
        team_id=team.id,
        user_id=current_user_id,
        role='admin'
    )
    db.session.add(team_member)
    db.session.commit()
    
    return jsonify({
        'message': 'Team created successfully',
        'team': team.to_dict(include_members=True)
    }), 201


@bp.route('/', methods=['GET'])
@jwt_required()
def list_teams():
    """List all teams the user is a member of."""
    current_user_id = get_jwt_identity()
    
    # Get user's team memberships
    memberships = TeamMember.query.filter_by(user_id=current_user_id).all()
    teams = [membership.team.to_dict() for membership in memberships]
    
    return jsonify({
        'teams': teams
    }), 200


@bp.route('/<int:team_id>', methods=['GET'])
@jwt_required()
@require_team_membership()
def get_team(team_id):
    """Get team details by ID."""
    team = Team.query.get_or_404(team_id)
    return jsonify({
        'team': team.to_dict(include_members=True)
    }), 200


@bp.route('/<int:team_id>', methods=['PUT'])
@jwt_required()
@require_team_membership(required_role='admin')
def update_team(team_id):
    """Update team information."""
    team = Team.query.get_or_404(team_id)
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        team.name = data['name']
    if 'description' in data:
        team.description = data['description']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Team updated successfully',
        'team': team.to_dict()
    }), 200


@bp.route('/<int:team_id>', methods=['DELETE'])
@jwt_required()
@require_team_membership(required_role='admin')
def delete_team(team_id):
    """Delete a team."""
    team = Team.query.get_or_404(team_id)
    db.session.delete(team)
    db.session.commit()
    
    return jsonify({
        'message': 'Team deleted successfully'
    }), 200


# Team Member Management

@bp.route('/<int:team_id>/members', methods=['POST'])
@jwt_required()
@require_team_membership(required_role='admin')
def add_team_member(team_id):
    """Add a member to the team."""
    data = request.get_json()
    
    # Validate required fields
    if not data.get('user_id'):
        return jsonify({'error': 'User ID is required'}), 400
    
    user_id = data['user_id']
    role = data.get('role', 'member')
    
    # Check if user exists
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Check if already a member
    existing = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first()
    if existing:
        return jsonify({'error': 'User is already a team member'}), 409
    
    # Add member
    team_member = TeamMember(
        team_id=team_id,
        user_id=user_id,
        role=role
    )
    db.session.add(team_member)
    db.session.commit()
    
    return jsonify({
        'message': 'Team member added successfully',
        'member': team_member.to_dict()
    }), 201


@bp.route('/<int:team_id>/members/<int:user_id>', methods=['PUT'])
@jwt_required()
@require_team_membership(required_role='admin')
def update_team_member(team_id, user_id):
    """Update a team member's role."""
    data = request.get_json()
    
    member = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first_or_404()
    
    if 'role' in data:
        member.role = data['role']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Team member updated successfully',
        'member': member.to_dict()
    }), 200


@bp.route('/<int:team_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
@require_team_membership(required_role='admin')
def remove_team_member(team_id, user_id):
    """Remove a member from the team."""
    current_user_id = get_jwt_identity()
    
    # Prevent removing yourself if you're the last admin
    if current_user_id == user_id:
        admin_count = TeamMember.query.filter_by(team_id=team_id, role='admin').count()
        if admin_count <= 1:
            return jsonify({'error': 'Cannot remove the last admin'}), 400
    
    member = TeamMember.query.filter_by(team_id=team_id, user_id=user_id).first_or_404()
    db.session.delete(member)
    db.session.commit()
    
    return jsonify({
        'message': 'Team member removed successfully'
    }), 200
