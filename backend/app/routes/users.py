from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.user import User

bp = Blueprint('users', __name__)


@bp.route('/', methods=['GET'])
@jwt_required()
def list_users():
    """List all users (admin only or team members)."""
    # TODO: Implement user listing with proper permissions
    users = User.query.all()
    return jsonify({
        'users': [user.to_dict(include_email=False) for user in users]
    }), 200


@bp.route('/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user by ID."""
    user = User.query.get_or_404(user_id)
    return jsonify({
        'user': user.to_dict(include_email=False)
    }), 200


@bp.route('/<int:user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user information."""
    current_user_id = get_jwt_identity()
    
    # Only allow users to update their own profile (or admins)
    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    # Update allowed fields
    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    
    db.session.commit()
    
    return jsonify({
        'message': 'User updated successfully',
        'user': user.to_dict()
    }), 200
