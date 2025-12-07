"""Saved queries API routes."""
from flask import Blueprint, request, jsonify, g
from app import db
from app.models import SavedQuery, Timeline
from app.auth import require_auth
from sqlalchemy import or_

bp = Blueprint('saved_queries', __name__)


@bp.route('/api/timelines/<int:timeline_id>/saved-queries', methods=['GET'])
@require_auth
def get_saved_queries(timeline_id):
    """Get all saved queries for a timeline."""
    # Verify timeline access
    timeline = Timeline.query.get_or_404(timeline_id)
    
    # Get queries that are:
    # 1. Created by current user, OR
    # 2. Shared and user is in the same team
    queries = SavedQuery.query.filter(
        SavedQuery.timeline_id == timeline_id,
        or_(
            SavedQuery.created_by == g.current_user.id,
            SavedQuery.is_shared == True
        )
    ).order_by(
        SavedQuery.is_pinned.desc(),
        SavedQuery.created_at.desc()
    ).all()
    
    return jsonify([q.to_dict() for q in queries]), 200


@bp.route('/api/timelines/<int:timeline_id>/saved-queries', methods=['POST'])
@require_auth
def create_saved_query(timeline_id):
    """Create a new saved query."""
    # Verify timeline access
    timeline = Timeline.query.get_or_404(timeline_id)
    
    data = request.get_json()
    
    if not data.get('name'):
        return jsonify({'error': 'Name is required'}), 400
    
    if not data.get('query_config'):
        return jsonify({'error': 'Query configuration is required'}), 400
    
    # Get team_id from timeline's project if sharing
    team_id = None
    if data.get('is_shared'):
        # Get the team from the timeline's project
        if timeline.project and timeline.project.team_id:
            team_id = timeline.project.team_id
    
    # Create saved query
    saved_query = SavedQuery(
        timeline_id=timeline_id,
        created_by=g.current_user.id,
        team_id=team_id,
        name=data['name'],
        description=data.get('description'),
        query_config=data['query_config'],
        is_shared=data.get('is_shared', False),
        is_pinned=data.get('is_pinned', False)
    )
    
    db.session.add(saved_query)
    db.session.commit()
    
    return jsonify(saved_query.to_dict()), 201


@bp.route('/api/saved-queries/<int:query_id>', methods=['GET'])
@require_auth
def get_saved_query(query_id):
    """Get a specific saved query."""
    saved_query = SavedQuery.query.get_or_404(query_id)
    
    # Check access
    if saved_query.created_by != g.current_user.id and not saved_query.is_shared:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(saved_query.to_dict()), 200


@bp.route('/api/saved-queries/<int:query_id>', methods=['PUT'])
@require_auth
def update_saved_query(query_id):
    """Update a saved query."""
    saved_query = SavedQuery.query.get_or_404(query_id)
    
    # Only creator can update
    if saved_query.created_by != g.current_user.id:
        return jsonify({'error': 'Only the creator can update this query'}), 403
    
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        saved_query.name = data['name']
    if 'description' in data:
        saved_query.description = data['description']
    if 'query_config' in data:
        saved_query.query_config = data['query_config']
    if 'is_shared' in data:
        saved_query.is_shared = data['is_shared']
        if data['is_shared']:
            # Get team from timeline's project
            if saved_query.timeline.project and saved_query.timeline.project.team_id:
                saved_query.team_id = saved_query.timeline.project.team_id
        else:
            saved_query.team_id = None
    if 'is_pinned' in data:
        saved_query.is_pinned = data['is_pinned']
    
    db.session.commit()
    
    return jsonify(saved_query.to_dict()), 200


@bp.route('/api/saved-queries/<int:query_id>', methods=['DELETE'])
@require_auth
def delete_saved_query(query_id):
    """Delete a saved query."""
    saved_query = SavedQuery.query.get_or_404(query_id)
    
    # Only creator can delete
    if saved_query.created_by != g.current_user.id:
        return jsonify({'error': 'Only the creator can delete this query'}), 403
    
    db.session.delete(saved_query)
    db.session.commit()
    
    return '', 204


@bp.route('/api/saved-queries/<int:query_id>/pin', methods=['POST'])
@require_auth
def pin_saved_query(query_id):
    """Pin/unpin a saved query."""
    saved_query = SavedQuery.query.get_or_404(query_id)
    
    # Only creator can pin/unpin
    if saved_query.created_by != g.current_user.id:
        return jsonify({'error': 'Only the creator can pin this query'}), 403
    
    data = request.get_json()
    saved_query.is_pinned = data.get('is_pinned', False)
    
    db.session.commit()
    
    return jsonify(saved_query.to_dict()), 200
