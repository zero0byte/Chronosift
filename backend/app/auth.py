"""Authentication decorators and utilities."""
from functools import wraps
from flask import g, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.user import User


def require_auth(fn):
    """
    Decorator that combines JWT validation with user loading.
    
    This decorator:
    1. Validates JWT token using @jwt_required()
    2. Loads the user from database
    3. Stores user in g.current_user for easy access
    4. Returns 401 if user not found or inactive
    
    Usage:
        @bp.route('/protected')
        @require_auth
        def protected_route():
            user = g.current_user
            return jsonify({'user_id': user.id})
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        # Get user ID from JWT
        current_user_id = get_jwt_identity()
        
        # Load user from database
        user = User.query.get(int(current_user_id))
        
        if not user:
            return jsonify({'error': 'User not found'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Account is inactive'}), 403
        
        # Store user in Flask's g object for access in route handlers
        g.current_user = user
        
        # Call the actual route handler
        return fn(*args, **kwargs)
    
    return wrapper
