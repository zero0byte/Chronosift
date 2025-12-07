from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Comment, CommentMention, TimelineEntry, User, Activity
from app.socket_events import broadcast_comment_added, broadcast_comment_updated, broadcast_comment_deleted, broadcast_activity, broadcast_mention
import re

bp = Blueprint('comments', __name__, url_prefix='/comments')


def parse_mentions(content):
    """Extract @mentions from comment content."""
    # Match @username or @"First Last" patterns
    mention_pattern = r'@(\w+)|@"([^"]+)"'
    matches = re.findall(mention_pattern, content)
    # Flatten and filter empty strings
    mentions = [m[0] or m[1] for m in matches if m[0] or m[1]]
    return mentions


def create_activity(project_id, user_id, activity_type, entity_type, entity_id, metadata=None):
    """Helper function to create activity log entries."""
    activity = Activity(
        project_id=project_id,
        user_id=user_id,
        activity_type=activity_type,
        entity_type=entity_type,
        entity_id=entity_id,
        meta_data=metadata or {}
    )
    db.session.add(activity)
    return activity


@bp.route('/entry/<int:entry_id>', methods=['GET'])
@jwt_required()
def get_entry_comments(entry_id):
    """Get all comments for a timeline entry."""
    entry = TimelineEntry.query.get_or_404(entry_id)
    
    # Get top-level comments (no parent)
    comments = Comment.query.filter_by(
        entry_id=entry_id,
        parent_id=None
    ).order_by(Comment.created_at.asc()).all()
    
    return jsonify({
        'comments': [comment.to_dict(include_replies=True) for comment in comments]
    })


@bp.route('/entry/<int:entry_id>', methods=['POST'])
@jwt_required()
def create_comment(entry_id):
    """Create a new comment on a timeline entry."""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if 'content' not in data or not data['content'].strip():
        return jsonify({'error': 'Comment content is required'}), 400
    
    entry = TimelineEntry.query.get_or_404(entry_id)
    
    # Create comment
    comment = Comment(
        entry_id=entry_id,
        user_id=current_user_id,
        content=data['content'].strip(),
        parent_id=data.get('parent_id')
    )
    db.session.add(comment)
    db.session.flush()  # Get comment ID
    
    # Parse and create mentions
    mentioned_usernames = parse_mentions(data['content'])
    for username in mentioned_usernames:
        # Try to find user by email (username) or by first/last name
        user = User.query.filter(
            db.or_(
                User.email.ilike(f'%{username}%'),
                User.first_name.ilike(f'%{username}%'),
                User.last_name.ilike(f'%{username}%')
            )
        ).first()
        
        if user and user.id != current_user_id:
            mention = CommentMention(
                comment_id=comment.id,
                mentioned_user_id=user.id
            )
            db.session.add(mention)
    
    # Create activity log
    create_activity(
        project_id=entry.timeline.project_id,
        user_id=current_user_id,
        activity_type='comment_added',
        entity_type='comment',
        entity_id=comment.id,
        metadata={
            'entry_id': entry_id,
            'timeline_id': entry.timeline_id,
            'timeline_name': entry.timeline.name,
            'content_preview': data['content'][:100]
        }
    )
    
    db.session.commit()
    
    # Broadcast WebSocket events
    comment_dict = comment.to_dict(include_replies=False)
    broadcast_comment_added(entry.timeline.project_id, comment_dict)
    
    # Broadcast activity
    activity_dict = Activity.query.filter_by(
        entity_type='comment',
        entity_id=comment.id
    ).first().to_dict()
    broadcast_activity(entry.timeline.project_id, activity_dict)
    
    # Notify mentioned users
    for mention in comment.mentions:
        broadcast_mention(mention.mentioned_user_id, mention.to_dict())
    
    return jsonify({
        'message': 'Comment created successfully',
        'comment': comment_dict
    }), 201


@bp.route('/<int:comment_id>', methods=['PUT'])
@jwt_required()
def update_comment(comment_id):
    """Update a comment (only by the author)."""
    current_user_id = int(get_jwt_identity())
    comment = Comment.query.get_or_404(comment_id)
    
    if comment.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if 'content' not in data or not data['content'].strip():
        return jsonify({'error': 'Comment content is required'}), 400
    
    # Update comment
    comment.content = data['content'].strip()
    comment.is_edited = True
    
    # Delete existing mentions and re-parse
    CommentMention.query.filter_by(comment_id=comment_id).delete()
    
    mentioned_usernames = parse_mentions(data['content'])
    for username in mentioned_usernames:
        user = User.query.filter(
            db.or_(
                User.email.ilike(f'%{username}%'),
                User.first_name.ilike(f'%{username}%'),
                User.last_name.ilike(f'%{username}%')
            )
        ).first()
        
        if user and user.id != current_user_id:
            mention = CommentMention(
                comment_id=comment.id,
                mentioned_user_id=user.id
            )
            db.session.add(mention)
    
    db.session.commit()
    
    # Broadcast WebSocket event
    comment_dict = comment.to_dict(include_replies=False)
    broadcast_comment_updated(comment.entry.timeline.project_id, comment_dict)
    
    # Notify newly mentioned users
    for mention in comment.mentions:
        broadcast_mention(mention.mentioned_user_id, mention.to_dict())
    
    return jsonify({
        'message': 'Comment updated successfully',
        'comment': comment_dict
    })


@bp.route('/<int:comment_id>', methods=['DELETE'])
@jwt_required()
def delete_comment(comment_id):
    """Delete a comment (only by the author)."""
    current_user_id = int(get_jwt_identity())
    comment = Comment.query.get_or_404(comment_id)
    
    if comment.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    project_id = comment.entry.timeline.project_id
    
    db.session.delete(comment)
    db.session.commit()
    
    # Broadcast WebSocket event
    broadcast_comment_deleted(project_id, comment_id)
    
    return jsonify({'message': 'Comment deleted successfully'})


@bp.route('/mentions', methods=['GET'])
@jwt_required()
def get_user_mentions():
    """Get all mentions for the current user."""
    current_user_id = int(get_jwt_identity())
    
    # Query parameters
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    
    query = CommentMention.query.filter_by(mentioned_user_id=current_user_id)
    
    if unread_only:
        query = query.filter_by(is_read=False)
    
    mentions = query.order_by(CommentMention.created_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    
    return jsonify({
        'mentions': [m.to_dict() for m in mentions.items],
        'total': mentions.total,
        'page': page,
        'per_page': per_page,
        'pages': mentions.pages
    })


@bp.route('/mentions/<int:mention_id>/read', methods=['PUT'])
@jwt_required()
def mark_mention_read(mention_id):
    """Mark a mention as read."""
    current_user_id = int(get_jwt_identity())
    mention = CommentMention.query.get_or_404(mention_id)
    
    if mention.mentioned_user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    mention.is_read = True
    db.session.commit()
    
    return jsonify({'message': 'Mention marked as read'})


@bp.route('/mentions/read-all', methods=['PUT'])
@jwt_required()
def mark_all_mentions_read():
    """Mark all mentions as read for the current user."""
    current_user_id = int(get_jwt_identity())
    
    CommentMention.query.filter_by(
        mentioned_user_id=current_user_id,
        is_read=False
    ).update({'is_read': True})
    
    db.session.commit()
    
    return jsonify({'message': 'All mentions marked as read'})
