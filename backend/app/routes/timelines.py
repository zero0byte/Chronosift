from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.timeline import Timeline, ColumnDefinition, TimelineEntry
from app.models.project import Project, ProjectMember
from app.utils.permissions import require_project_permission
from functools import wraps

bp = Blueprint('timelines', __name__)


def check_timeline_access(permission='read'):
    """Decorator to check if user has access to a timeline via project membership."""
    def decorator(f):
        @wraps(f)
        def decorated_function(timeline_id, *args, **kwargs):
            current_user_id = int(get_jwt_identity())
            
            # Get timeline and its project
            timeline = Timeline.query.get_or_404(timeline_id)
            project = Project.query.get_or_404(timeline.project_id)
            
            # Check if user is a project member with appropriate permissions
            member = ProjectMember.query.filter_by(
                project_id=project.id,
                user_id=current_user_id
            ).first()
            
            if not member:
                return jsonify({'error': 'Access denied. You are not a member of this project.'}), 403
            
            # Check permission level
            if permission == 'write' and member.permissions == 'read':
                return jsonify({'error': 'Write access required'}), 403
            elif permission == 'admin' and member.permissions != 'admin':
                return jsonify({'error': 'Admin access required'}), 403
            
            return f(timeline_id, *args, **kwargs)
        return decorated_function
    return decorator


@bp.route('/', methods=['POST'])
@jwt_required()
def create_timeline():
    """Create a new timeline."""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    # Validation
    if 'name' not in data or not data['name'].strip():
        return jsonify({'error': 'Timeline name is required'}), 400
    
    # Prevent manual creation of timelines with "master" in the name
    # Master timelines should only be created via the Promote function
    if not data.get('is_master', False) and 'master' in data['name'].lower():
        return jsonify({'error': 'Timeline names cannot contain "master". Master timelines are created automatically via the Promote feature.'}), 400
    if not data.get('project_id'):
        return jsonify({'error': 'Project ID is required'}), 400
    
    project_id = data['project_id']
    
    # Check project access (need write permission)
    project = Project.query.get_or_404(project_id)
    # TODO: Check if user has write access to project
    
    # Create timeline
    timeline = Timeline(
        name=data['name'],
        description=data.get('description'),
        project_id=project_id,
        created_by=current_user_id
    )
    db.session.add(timeline)
    db.session.flush()
    
    # Create default columns if provided
    column_order = 0
    if 'columns' in data and isinstance(data['columns'], list):
        for idx, col_data in enumerate(data['columns']):
            column = ColumnDefinition(
                timeline_id=timeline.id,
                name=col_data['name'],
                column_type=col_data['column_type'],
                config=col_data.get('config', {}),
                order=idx,
                is_required=col_data.get('is_required', False),
                is_searchable=col_data.get('is_searchable', True)
            )
            db.session.add(column)
            column_order = idx + 1
    
    # Always add LLM Analysis and Priority columns
    llm_analysis_col = ColumnDefinition(
        timeline_id=timeline.id,
        name='LLM Analysis',
        column_type='text',
        config={},
        order=column_order,
        is_required=False,
        is_searchable=True
    )
    db.session.add(llm_analysis_col)
    
    priority_col = ColumnDefinition(
        timeline_id=timeline.id,
        name='Priority',
        column_type='text',
        config={},
        order=column_order + 1,
        is_required=False,
        is_searchable=True
    )
    db.session.add(priority_col)
    
    db.session.commit()
    
    return jsonify({
        'message': 'Timeline created successfully',
        'timeline': timeline.to_dict(include_columns=True)
    }), 201


@bp.route('/<int:timeline_id>', methods=['GET'])
@jwt_required()
@check_timeline_access('read')
def get_timeline(timeline_id):
    """Get timeline details with columns and optionally entries."""
    timeline = Timeline.query.get_or_404(timeline_id)
    
    include_entries = request.args.get('include_entries', 'false').lower() == 'true'
    
    return jsonify({
        'timeline': timeline.to_dict(include_columns=True, include_entries=include_entries)
    }), 200


@bp.route('/<int:timeline_id>', methods=['PUT'])
@jwt_required()
@check_timeline_access('write')
def update_timeline(timeline_id):
    """Update a timeline's metadata."""
    timeline = Timeline.query.get_or_404(timeline_id)
    data = request.get_json()
    
    if 'name' in data:
        # Prevent renaming to include "master" unless it's already a master timeline
        if not timeline.is_master and 'master' in data['name'].lower():
            return jsonify({'error': 'Timeline names cannot contain "master". Master timelines are created automatically via the Promote feature.'}), 400
        timeline.name = data['name']
        timeline.name = data['name']
    if 'description' in data:
        timeline.description = data['description']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Timeline updated successfully',
        'timeline': timeline.to_dict()
    }), 200


@bp.route('/<int:timeline_id>', methods=['DELETE'])
@jwt_required()
@check_timeline_access('admin')
def delete_timeline(timeline_id):
    """Delete a timeline."""
    timeline = Timeline.query.get_or_404(timeline_id)
    db.session.delete(timeline)
    db.session.commit()
    
    return jsonify({
        'message': 'Timeline deleted successfully'
    }), 200


# Column Definition Management

@bp.route('/<int:timeline_id>/columns', methods=['POST'])
@jwt_required()
@check_timeline_access('write')
def add_column(timeline_id):
    """Add a new column to the timeline."""
    timeline = Timeline.query.get_or_404(timeline_id)
    data = request.get_json()
    
    # Get the highest order number
    max_order = db.session.query(db.func.max(ColumnDefinition.order)).filter_by(
        timeline_id=timeline_id
    ).scalar() or -1
    
    column = ColumnDefinition(
        timeline_id=timeline_id,
        name=data['name'],
        column_type=data['column_type'],
        config=data.get('config', {}),
        order=max_order + 1,
        is_required=data.get('is_required', False),
        is_searchable=data.get('is_searchable', True)
    )
    db.session.add(column)
    db.session.commit()
    
    return jsonify({
        'message': 'Column added successfully',
        'column': column.to_dict()
    }), 201


@bp.route('/<int:timeline_id>/columns/<int:column_id>', methods=['PUT'])
@jwt_required()
@check_timeline_access('write')
def update_column(timeline_id, column_id):
    """Update a column definition."""
    column = ColumnDefinition.query.filter_by(
        id=column_id,
        timeline_id=timeline_id
    ).first_or_404()
    
    data = request.get_json()
    
    if 'name' in data:
        column.name = data['name']
    if 'column_type' in data:
        column.column_type = data['column_type']
    if 'config' in data:
        column.config = data['config']
    if 'is_required' in data:
        column.is_required = data['is_required']
    if 'is_searchable' in data:
        column.is_searchable = data['is_searchable']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Column updated successfully',
        'column': column.to_dict()
    }), 200


@bp.route('/<int:timeline_id>/columns/<int:column_id>', methods=['DELETE'])
@jwt_required()
@check_timeline_access('write')
def delete_column(timeline_id, column_id):
    """Delete a column definition."""
    column = ColumnDefinition.query.filter_by(
        id=column_id,
        timeline_id=timeline_id
    ).first_or_404()
    
    db.session.delete(column)
    db.session.commit()
    
    return jsonify({
        'message': 'Column deleted successfully'
    }), 200


# Timeline Entry Management

@bp.route('/<int:timeline_id>/entries', methods=['GET'])
@jwt_required()
@check_timeline_access('read')
def list_entries(timeline_id):
    """List timeline entries with pagination."""
    timeline = Timeline.query.get_or_404(timeline_id)
    
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    query = TimelineEntry.query.filter_by(timeline_id=timeline_id)
    
    # Pagination
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'entries': [entry.to_dict() for entry in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    }), 200


@bp.route('/<int:timeline_id>/entries', methods=['POST'])
@jwt_required()
@check_timeline_access('write')
def create_entry(timeline_id):
    """Create a new timeline entry."""
    current_user_id = int(get_jwt_identity())
    timeline = Timeline.query.get_or_404(timeline_id)
    data = request.get_json()
    
    if 'data' not in data:
        return jsonify({'error': 'Entry data is required'}), 400
    
    entry = TimelineEntry(
        timeline_id=timeline_id,
        data=data['data'],
        created_by=current_user_id
    )
    db.session.add(entry)
    db.session.commit()
    
    return jsonify({
        'message': 'Entry created successfully',
        'entry': entry.to_dict()
    }), 201


@bp.route('/<int:timeline_id>/entries/bulk', methods=['POST'])
@jwt_required()
@check_timeline_access('write')
def create_entries_bulk(timeline_id):
    """Create multiple timeline entries at once."""
    current_user_id = int(get_jwt_identity())
    timeline = Timeline.query.get_or_404(timeline_id)
    data = request.get_json()
    
    if 'entries' not in data or not isinstance(data['entries'], list):
        return jsonify({'error': 'Entries array is required'}), 400
    
    entries = []
    for entry_data in data['entries']:
        entry = TimelineEntry(
            timeline_id=timeline_id,
            data=entry_data,
            created_by=current_user_id
        )
        entries.append(entry)
    
    db.session.add_all(entries)
    db.session.commit()
    
    return jsonify({
        'message': f'{len(entries)} entries created successfully',
        'count': len(entries)
    }), 201


@bp.route('/<int:timeline_id>/entries/<int:entry_id>', methods=['GET'])
@jwt_required()
@check_timeline_access('read')
def get_entry(timeline_id, entry_id):
    """Get a specific timeline entry."""
    entry = TimelineEntry.query.filter_by(
        id=entry_id,
        timeline_id=timeline_id
    ).first_or_404()
    
    return jsonify({
        'entry': entry.to_dict()
    }), 200


@bp.route('/<int:timeline_id>/entries/<int:entry_id>', methods=['PUT'])
@jwt_required()
@check_timeline_access('write')
def update_entry(timeline_id, entry_id):
    """Update a timeline entry."""
    entry = TimelineEntry.query.filter_by(
        id=entry_id,
        timeline_id=timeline_id
    ).first_or_404()
    
    data = request.get_json()
    
    if 'data' in data:
        entry.data = data['data']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Entry updated successfully',
        'entry': entry.to_dict()
    }), 200


@bp.route('/<int:timeline_id>/entries/<int:entry_id>', methods=['DELETE'])
@jwt_required()
@check_timeline_access('write')
def delete_entry(timeline_id, entry_id):
    """Delete a timeline entry."""
    entry = TimelineEntry.query.filter_by(
        id=entry_id,
        timeline_id=timeline_id
    ).first_or_404()
    
    db.session.delete(entry)
    db.session.commit()
    
    return jsonify({
        'message': 'Entry deleted successfully'
    }), 200


@bp.route('/<int:timeline_id>/search', methods=['GET'])
@jwt_required()
@check_timeline_access('read')
def search_entries(timeline_id):
    """
    Search timeline entries using PostgreSQL JSONB search.
    
    Supports multiple search modes:
    - q: Simple text search across all fields
    - field: Specific field to search (e.g., Description, Tags)
    - filter: JSONB containment filter (exact match)
    - sort: Sort field and direction
    """
    timeline = Timeline.query.get_or_404(timeline_id)
    
    query_text = request.args.get('q', '')
    field_name = request.args.get('field', '')
    filter_json = request.args.get('filter', '')
    sort_field = request.args.get('sort_by', '')
    sort_dir = request.args.get('sort_dir', 'asc')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    # Start with base query
    query = TimelineEntry.query.filter_by(timeline_id=timeline_id)
    
    # Text search
    if query_text:
        if field_name:
            # Search specific field using JSONB ->> operator
            query = query.filter(
                db.func.lower(
                    TimelineEntry.data[field_name].astext
                ).like(f'%{query_text.lower()}%')
            )
        else:
            # Search across all text fields
            # Use PostgreSQL's to_tsvector for full-text search on the entire JSONB
            query = query.filter(
                db.func.to_tsvector('english', 
                    db.cast(TimelineEntry.data, db.Text)
                ).op('@@')(db.func.plainto_tsquery('english', query_text))
            )
    
    # JSONB containment filter (exact match)
    if filter_json:
        try:
            import json
            from datetime import datetime
            filter_dict = json.loads(filter_json)
            
            # Handle each filter field
            for field_name, field_filter in filter_dict.items():
                # Check if this is a timestamp range filter
                if isinstance(field_filter, dict) and 'start' in field_filter and 'end' in field_filter:
                    # Timestamp range filter
                    start_time = field_filter['start']
                    end_time = field_filter['end']
                    
                    # Cast the JSONB field to timestamp and compare
                    query = query.filter(
                        db.and_(
                            db.cast(TimelineEntry.data[field_name].astext, db.DateTime) >= start_time,
                            db.cast(TimelineEntry.data[field_name].astext, db.DateTime) <= end_time
                        )
                    )
                else:
                    # Standard containment filter for exact match
                    query = query.filter(
                        TimelineEntry.data.contains({field_name: field_filter})
                    )
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid JSON in filter parameter'}), 400
        except Exception as e:
            return jsonify({'error': f'Filter error: {str(e)}'}), 400
    
    # Sorting
    if sort_field:
        order_col = TimelineEntry.data[sort_field].astext
        if sort_dir == 'desc':
            query = query.order_by(db.desc(order_col))
        else:
            query = query.order_by(order_col)
    else:
        # Default sort by created_at desc
        query = query.order_by(db.desc(TimelineEntry.created_at))
    
    # Paginate results
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'entries': [entry.to_dict() for entry in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
        'query': query_text,
        'filter': filter_json if filter_json else None
    }), 200


@bp.route('/<int:timeline_id>/entries/around-timestamp', methods=['GET'])
@jwt_required()
@check_timeline_access('read')
def get_entries_around_timestamp(timeline_id):
    """
    Get entries centered around a specific timestamp.
    
    Query params:
    - timestamp: ISO timestamp to center around
    - timestamp_column: Name of the timestamp column (required)
    - limit: Number of entries to return (default 50)
    """
    timeline = Timeline.query.get_or_404(timeline_id)
    
    timestamp_str = request.args.get('timestamp')
    timestamp_column = request.args.get('timestamp_column')
    limit = request.args.get('limit', 50, type=int)
    
    if not timestamp_str:
        return jsonify({'error': 'timestamp parameter is required'}), 400
    if not timestamp_column:
        return jsonify({'error': 'timestamp_column parameter is required'}), 400
    
    # Parse timestamp
    from datetime import datetime
    try:
        target_timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'error': 'Invalid timestamp format. Use ISO format.'}), 400
    
    # Calculate how many entries to fetch before and after
    half_limit = limit // 2
    
    # Get entries before the timestamp (ordered desc, then reverse)
    before_query = TimelineEntry.query.filter_by(timeline_id=timeline_id).filter(
        db.cast(TimelineEntry.data[timestamp_column].astext, db.DateTime) < target_timestamp
    ).order_by(
        db.desc(db.cast(TimelineEntry.data[timestamp_column].astext, db.DateTime))
    ).limit(half_limit)
    
    # Get entries at or after the timestamp
    after_query = TimelineEntry.query.filter_by(timeline_id=timeline_id).filter(
        db.cast(TimelineEntry.data[timestamp_column].astext, db.DateTime) >= target_timestamp
    ).order_by(
        db.cast(TimelineEntry.data[timestamp_column].astext, db.DateTime)
    ).limit(half_limit)
    
    # Fetch results
    before_entries = list(reversed(before_query.all()))  # Reverse to get chronological order
    after_entries = after_query.all()
    
    # Combine
    combined_entries = before_entries + after_entries
    
    return jsonify({
        'entries': [entry.to_dict() for entry in combined_entries],
        'total': len(combined_entries),
        'center_timestamp': timestamp_str,
        'before_count': len(before_entries),
        'after_count': len(after_entries)
    }), 200


@bp.route('/<int:timeline_id>/entries/promote', methods=['POST'])
@jwt_required()
@check_timeline_access('write')
def promote_entries(timeline_id):
    """Promote selected entries to master timeline."""
    current_user_id = int(get_jwt_identity())
    source_timeline = Timeline.query.get_or_404(timeline_id)
    data = request.get_json()
    
    if 'entry_ids' not in data or not isinstance(data['entry_ids'], list):
        return jsonify({'error': 'entry_ids array is required'}), 400
    
    # Get or create master timeline for this project
    master_timeline = Timeline.query.filter_by(
        project_id=source_timeline.project_id,
        is_master=True
    ).first()
    
    if not master_timeline:
        # Create master timeline
        master_timeline = Timeline(
            name='Master Timeline',
            description='Consolidated timeline of promoted events',
            project_id=source_timeline.project_id,
            created_by=current_user_id,
            is_master=True
        )
        db.session.add(master_timeline)
        db.session.flush()
        
        # Create standard columns
        columns = [
            {'name': 'Timestamp', 'column_type': 'timestamp', 'order': 0, 'is_required': True, 'is_searchable': True},
            {'name': 'Description', 'column_type': 'text', 'order': 1, 'is_required': False, 'is_searchable': True},
            {'name': 'Link', 'column_type': 'text', 'order': 2, 'is_required': False, 'is_searchable': False},
        ]
        for col_data in columns:
            column = ColumnDefinition(
                timeline_id=master_timeline.id,
                **col_data
            )
            db.session.add(column)
        db.session.flush()
    
    # Promote entries
    promoted_count = 0
    for entry_id in data['entry_ids']:
        source_entry = TimelineEntry.query.filter_by(
            id=entry_id,
            timeline_id=timeline_id
        ).first()
        
        if source_entry:
            # Extract key fields
            timestamp = source_entry.data.get('Timestamp') or source_entry.data.get('timestamp')
            description = source_entry.data.get('Description') or source_entry.data.get('description') or 'Promoted event'
            
            # Create link back to source
            link = f'/timelines/{timeline_id}?entry={entry_id}'
            
            # Create promoted entry
            promoted_entry = TimelineEntry(
                timeline_id=master_timeline.id,
                data={
                    'Timestamp': timestamp,
                    'Description': description,
                    'Link': link,
                    '_source_timeline_id': timeline_id,
                    '_source_entry_id': entry_id,
                    '_source_timeline_name': source_timeline.name
                },
                created_by=current_user_id
            )
            db.session.add(promoted_entry)
            promoted_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': f'Promoted {promoted_count} entries to Master Timeline',
        'promoted_count': promoted_count,
        'master_timeline_id': master_timeline.id
    }), 201
