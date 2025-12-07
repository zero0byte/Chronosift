from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.view import SavedView
from app.models.timeline import Timeline

bp = Blueprint('views', __name__)


@bp.route('/timeline/<int:timeline_id>', methods=['GET'])
@jwt_required()
def list_views(timeline_id):
    """List all views for a timeline."""
    current_user_id = int(get_jwt_identity())
    
    # Verify timeline exists
    timeline = Timeline.query.get_or_404(timeline_id)
    
    # Get user's views + shared views
    views = SavedView.query.filter(
        SavedView.timeline_id == timeline_id,
        db.or_(
            SavedView.created_by == current_user_id,
            SavedView.is_shared == True
        )
    ).order_by(SavedView.is_pinned.desc(), SavedView.created_at.desc()).all()
    
    return jsonify({
        'views': [v.to_dict() for v in views]
    }), 200


@bp.route('/', methods=['POST'])
@jwt_required()
def create_view():
    """Create a new saved view."""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'View name is required'}), 400
    if not data.get('timeline_id'):
        return jsonify({'error': 'timeline_id is required'}), 400
    
    timeline_id = data['timeline_id']
    
    # Verify timeline exists
    timeline = Timeline.query.get_or_404(timeline_id)
    
    view = SavedView(
        timeline_id=timeline_id,
        name=data['name'],
        description=data.get('description'),
        created_by=current_user_id,
        is_pinned=data.get('is_pinned', False),
        is_shared=data.get('is_shared', False),
        filter_config=data.get('filter_config', {}),
        sort_config=data.get('sort_config', {}),
        visible_columns=data.get('visible_columns', []),
        column_widths=data.get('column_widths', {})
    )
    
    db.session.add(view)
    db.session.commit()
    
    return jsonify({
        'message': 'View created successfully',
        'view': view.to_dict()
    }), 201


@bp.route('/<int:view_id>', methods=['GET'])
@jwt_required()
def get_view(view_id):
    """Get view details."""
    current_user_id = int(get_jwt_identity())
    view = SavedView.query.get_or_404(view_id)
    
    # Check access
    if not (view.created_by == current_user_id or view.is_shared):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'view': view.to_dict()
    }), 200


@bp.route('/<int:view_id>', methods=['PUT'])
@jwt_required()
def update_view(view_id):
    """Update a saved view."""
    current_user_id = int(get_jwt_identity())
    view = SavedView.query.get_or_404(view_id)
    
    # Only creator can update
    if view.created_by != current_user_id:
        return jsonify({'error': 'Only the creator can update this view'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        view.name = data['name']
    if 'description' in data:
        view.description = data['description']
    if 'is_pinned' in data:
        view.is_pinned = data['is_pinned']
    if 'is_shared' in data:
        view.is_shared = data['is_shared']
    if 'filter_config' in data:
        view.filter_config = data['filter_config']
    if 'sort_config' in data:
        view.sort_config = data['sort_config']
    if 'visible_columns' in data:
        view.visible_columns = data['visible_columns']
    if 'column_widths' in data:
        view.column_widths = data['column_widths']
    
    db.session.commit()
    
    return jsonify({
        'message': 'View updated successfully',
        'view': view.to_dict()
    }), 200


@bp.route('/<int:view_id>', methods=['DELETE'])
@jwt_required()
def delete_view(view_id):
    """Delete a saved view."""
    current_user_id = int(get_jwt_identity())
    view = SavedView.query.get_or_404(view_id)
    
    # Only creator can delete
    if view.created_by != current_user_id:
        return jsonify({'error': 'Only the creator can delete this view'}), 403
    
    db.session.delete(view)
    db.session.commit()
    
    return jsonify({
        'message': 'View deleted successfully'
    }), 200


@bp.route('/<int:view_id>/pin', methods=['PUT'])
@jwt_required()
def toggle_pin(view_id):
    """Toggle pin status of a view."""
    current_user_id = int(get_jwt_identity())
    view = SavedView.query.get_or_404(view_id)
    
    # Only creator can pin/unpin
    if view.created_by != current_user_id:
        return jsonify({'error': 'Only the creator can pin/unpin this view'}), 403
    
    view.is_pinned = not view.is_pinned
    db.session.commit()
    
    return jsonify({
        'message': f'View {"pinned" if view.is_pinned else "unpinned"} successfully',
        'view': view.to_dict()
    }), 200
