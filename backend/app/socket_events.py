"""WebSocket event handlers for real-time updates."""
from flask import request
from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app import socketio, db
from app.models import User, ProjectMember, Project


def get_user_from_token(token):
    """Extract user ID from JWT token."""
    try:
        decoded = decode_token(token)
        return int(decoded['sub'])
    except Exception:
        return None


@socketio.on('connect')
def handle_connect(auth):
    """Handle client connection."""
    # Get token from auth object (more secure than query params)
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get('token')
    
    # Fallback to query params for backwards compatibility
    if not token:
        token = request.args.get('token')
    
    if not token:
        return False
    
    user_id = get_user_from_token(token)
    if not user_id:
        return False
    
    # Store user_id in session
    request.sid_user = user_id
    emit('connected', {'message': 'Connected to WebSocket'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection."""
    pass


@socketio.on('join_project')
def handle_join_project(data):
    """Join a project room for real-time updates."""
    token = data.get('token')
    project_id = data.get('project_id')
    
    if not token or not project_id:
        emit('error', {'message': 'Token and project_id required'})
        return
    
    user_id = get_user_from_token(token)
    if not user_id:
        emit('error', {'message': 'Invalid token'})
        return
    
    # Verify user has access to the project
    project = Project.query.get(project_id)
    if not project:
        emit('error', {'message': 'Project not found'})
        return
    
    is_member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    
    if not is_member and project.created_by != user_id:
        emit('error', {'message': 'Unauthorized'})
        return
    
    # Join the room
    room = f"project_{project_id}"
    join_room(room)
    emit('joined_project', {'project_id': project_id})


@socketio.on('leave_project')
def handle_leave_project(data):
    """Leave a project room."""
    project_id = data.get('project_id')
    if project_id:
        room = f"project_{project_id}"
        leave_room(room)
        emit('left_project', {'project_id': project_id})


# Utility functions to broadcast events from other parts of the app
def broadcast_comment_added(project_id, comment_data):
    """Broadcast when a new comment is added."""
    socketio.emit('comment_added', comment_data, room=f"project_{project_id}")


def broadcast_comment_updated(project_id, comment_data):
    """Broadcast when a comment is updated."""
    socketio.emit('comment_updated', comment_data, room=f"project_{project_id}")


def broadcast_comment_deleted(project_id, comment_id):
    """Broadcast when a comment is deleted."""
    socketio.emit('comment_deleted', {'comment_id': comment_id}, room=f"project_{project_id}")


def broadcast_entry_created(project_id, entry_data):
    """Broadcast when a new entry is created."""
    socketio.emit('entry_created', entry_data, room=f"project_{project_id}")


def broadcast_entry_updated(project_id, entry_data):
    """Broadcast when an entry is updated."""
    socketio.emit('entry_updated', entry_data, room=f"project_{project_id}")


def broadcast_entry_deleted(project_id, timeline_id, entry_id):
    """Broadcast when an entry is deleted."""
    socketio.emit('entry_deleted', {
        'timeline_id': timeline_id,
        'entry_id': entry_id
    }, room=f"project_{project_id}")


def broadcast_activity(project_id, activity_data):
    """Broadcast new activity."""
    socketio.emit('new_activity', activity_data, room=f"project_{project_id}")


def broadcast_mention(user_id, mention_data):
    """Broadcast mention notification to a specific user."""
    # Send to user-specific room (they need to join this on connect)
    socketio.emit('new_mention', mention_data, room=f"user_{user_id}")
