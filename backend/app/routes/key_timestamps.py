"""API routes for key timestamps."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_, cast, String
from datetime import datetime, timedelta
from app import db
from app.models.key_timestamp import KeyTimestamp
from app.models.project import Project, ProjectMember
from app.models.timeline import Timeline, TimelineEntry
from app.utils.permissions import require_project_permission


bp = Blueprint('key_timestamps', __name__)


@bp.route('/projects/<int:project_id>/key-timestamps', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def list_key_timestamps(project_id):
    """List all key timestamps for a project."""
    project = Project.query.get_or_404(project_id)
    
    timestamps = KeyTimestamp.query.filter_by(project_id=project_id)\
        .order_by(KeyTimestamp.timestamp.desc())\
        .all()
    
    return jsonify({
        'key_timestamps': [ts.to_dict() for ts in timestamps]
    }), 200


@bp.route('/projects/<int:project_id>/key-timestamps', methods=['POST'])
@jwt_required()
@require_project_permission('write')
def create_key_timestamp(project_id):
    """Create a new key timestamp."""
    project = Project.query.get_or_404(project_id)
    user_id = get_jwt_identity()
    
    data = request.get_json()
    
    # Validate required fields
    if not data.get('timestamp'):
        return jsonify({'error': 'timestamp is required'}), 400
    if not data.get('label'):
        return jsonify({'error': 'label is required'}), 400
    
    # Parse timestamp
    try:
        timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        return jsonify({'error': 'Invalid timestamp format. Use ISO format.'}), 400
    
    # Create key timestamp
    key_timestamp = KeyTimestamp(
        project_id=project_id,
        timestamp=timestamp,
        label=data['label'],
        description=data.get('description', ''),
        color=data.get('color', '#2563EB'),
        created_by=user_id
    )
    
    db.session.add(key_timestamp)
    db.session.commit()
    
    return jsonify({
        'message': 'Key timestamp created successfully',
        'key_timestamp': key_timestamp.to_dict()
    }), 201


@bp.route('/key-timestamps/<int:timestamp_id>', methods=['PUT'])
@jwt_required()
def update_key_timestamp(timestamp_id):
    """Update a key timestamp."""
    key_timestamp = KeyTimestamp.query.get_or_404(timestamp_id)
    user_id = get_jwt_identity()
    
    # Check if user has write permission on the project
    is_member = ProjectMember.query.filter_by(
        project_id=key_timestamp.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and key_timestamp.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    # Update fields
    if 'timestamp' in data:
        try:
            key_timestamp.timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
        except (ValueError, AttributeError):
            return jsonify({'error': 'Invalid timestamp format'}), 400
    
    if 'label' in data:
        key_timestamp.label = data['label']
    if 'description' in data:
        key_timestamp.description = data['description']
    if 'color' in data:
        key_timestamp.color = data['color']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Key timestamp updated successfully',
        'key_timestamp': key_timestamp.to_dict()
    }), 200


@bp.route('/key-timestamps/<int:timestamp_id>', methods=['DELETE'])
@jwt_required()
def delete_key_timestamp(timestamp_id):
    """Delete a key timestamp."""
    key_timestamp = KeyTimestamp.query.get_or_404(timestamp_id)
    user_id = get_jwt_identity()
    
    # Check if user has write permission on the project
    is_member = ProjectMember.query.filter_by(
        project_id=key_timestamp.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and key_timestamp.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(key_timestamp)
    db.session.commit()
    
    return jsonify({
        'message': 'Key timestamp deleted successfully'
    }), 200


@bp.route('/projects/<int:project_id>/key-timestamps/<int:timestamp_id>/search', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def search_around_key_timestamp(project_id, timestamp_id):
    """
    Search for timeline entries around a key timestamp across all project timelines.
    
    Query params:
    - timeline_ids: Optional comma-separated list of timeline IDs to search in
    - window_minutes: Time window in minutes (default: 60 = ±30 minutes)
    - limit: Max entries per timeline (default: 50)
    """
    project = Project.query.get_or_404(project_id)
    key_timestamp = KeyTimestamp.query.get_or_404(timestamp_id)
    
    # Verify key timestamp belongs to this project
    if key_timestamp.project_id != project_id:
        return jsonify({'error': 'Key timestamp does not belong to this project'}), 400
    
    # Get query parameters
    timeline_ids_param = request.args.get('timeline_ids', '')
    window_minutes = request.args.get('window_minutes', 60, type=int)
    limit = request.args.get('limit', 50, type=int)
    
    # Parse timeline IDs if provided
    timeline_ids = []
    if timeline_ids_param:
        try:
            timeline_ids = [int(tid) for tid in timeline_ids_param.split(',')]
        except ValueError:
            return jsonify({'error': 'Invalid timeline_ids format'}), 400
    
    # Get all timelines in the project (or filtered by timeline_ids)
    timelines_query = Timeline.query.filter_by(project_id=project_id)
    if timeline_ids:
        timelines_query = timelines_query.filter(Timeline.id.in_(timeline_ids))
    
    timelines = timelines_query.all()
    
    # Calculate time window
    half_window = timedelta(minutes=window_minutes / 2)
    start_time = key_timestamp.timestamp - half_window
    end_time = key_timestamp.timestamp + half_window
    
    # Search each timeline for entries in the time window
    results = []
    
    for timeline in timelines:
        # Find the timestamp column for this timeline
        timestamp_columns = [col for col in timeline.columns if col.column_type == 'timestamp']
        if not timestamp_columns:
            continue  # Skip timelines without timestamp columns
        
        timestamp_column = timestamp_columns[0]  # Use first timestamp column
        
        # Query entries within the time window
        entries = TimelineEntry.query.filter_by(timeline_id=timeline.id)\
            .filter(
                db.and_(
                    cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime) >= start_time,
                    cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime) <= end_time
                )
            )\
            .order_by(cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime))\
            .limit(limit)\
            .all()
        
        # Add entries to results with timeline context
        for entry in entries:
            entry_dict = entry.to_dict()
            entry_dict['timeline'] = {
                'id': timeline.id,
                'name': timeline.name,
                'is_master': timeline.is_master
            }
            entry_dict['timestamp_column'] = timestamp_column.name
            results.append(entry_dict)
    
    # Sort all results by timestamp
    results.sort(key=lambda x: x['data'].get(x['timestamp_column'], ''))
    
    return jsonify({
        'key_timestamp': key_timestamp.to_dict(),
        'time_window': {
            'start': start_time.isoformat(),
            'end': end_time.isoformat(),
            'window_minutes': window_minutes
        },
        'results': results,
        'total_entries': len(results),
        'timelines_searched': len(timelines)
    }), 200


@bp.route('/projects/<int:project_id>/key-timestamps/search-multiple', methods=['POST'])
@jwt_required()
@require_project_permission('read')
def search_around_multiple_timestamps(project_id):
    """
    Search for timeline entries around multiple key timestamps.
    
    Request body:
    {
        "timestamp_ids": [1, 2, 3],
        "window_minutes": 60,
        "timeline_ids": [1, 2],  // optional
        "limit_per_timestamp": 50
    }
    """
    project = Project.query.get_or_404(project_id)
    data = request.get_json()
    
    timestamp_ids = data.get('timestamp_ids', [])
    if not timestamp_ids:
        return jsonify({'error': 'timestamp_ids is required'}), 400
    
    window_minutes = data.get('window_minutes', 60)
    timeline_ids = data.get('timeline_ids', [])
    limit_per_timestamp = data.get('limit_per_timestamp', 50)
    
    # Get all key timestamps
    key_timestamps = KeyTimestamp.query.filter(
        KeyTimestamp.id.in_(timestamp_ids),
        KeyTimestamp.project_id == project_id
    ).all()
    
    if not key_timestamps:
        return jsonify({'error': 'No valid key timestamps found'}), 404
    
    # Get timelines
    timelines_query = Timeline.query.filter_by(project_id=project_id)
    if timeline_ids:
        timelines_query = timelines_query.filter(Timeline.id.in_(timeline_ids))
    timelines = timelines_query.all()
    
    # Search around each key timestamp
    all_results = []
    half_window = timedelta(minutes=window_minutes / 2)
    
    for key_timestamp in key_timestamps:
        start_time = key_timestamp.timestamp - half_window
        end_time = key_timestamp.timestamp + half_window
        
        for timeline in timelines:
            timestamp_columns = [col for col in timeline.columns if col.column_type == 'timestamp']
            if not timestamp_columns:
                continue
            
            timestamp_column = timestamp_columns[0]
            
            entries = TimelineEntry.query.filter_by(timeline_id=timeline.id)\
                .filter(
                    db.and_(
                        cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime) >= start_time,
                        cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime) <= end_time
                    )
                )\
                .order_by(cast(TimelineEntry.data[timestamp_column.name].astext, db.DateTime))\
                .limit(limit_per_timestamp)\
                .all()
            
            for entry in entries:
                entry_dict = entry.to_dict()
                entry_dict['timeline'] = {
                    'id': timeline.id,
                    'name': timeline.name,
                    'is_master': timeline.is_master
                }
                entry_dict['timestamp_column'] = timestamp_column.name
                entry_dict['key_timestamp_id'] = key_timestamp.id
                entry_dict['key_timestamp_label'] = key_timestamp.label
                all_results.append(entry_dict)
    
    # Remove duplicates and sort
    seen = set()
    unique_results = []
    for result in all_results:
        entry_id = result['id']
        if entry_id not in seen:
            seen.add(entry_id)
            unique_results.append(result)
    
    unique_results.sort(key=lambda x: x['data'].get(x['timestamp_column'], ''))
    
    return jsonify({
        'key_timestamps': [ts.to_dict() for ts in key_timestamps],
        'time_window_minutes': window_minutes,
        'results': unique_results,
        'total_entries': len(unique_results),
        'timelines_searched': len(timelines)
    }), 200
