from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.entry_link import EntryLink
from app.models.timeline import TimelineEntry, Timeline
from app.models.project import Project, ProjectMember

bp = Blueprint('entry_links', __name__)

def check_entry_access(user_id, entry_id):
    """Check if user has access to an entry's project."""
    entry = TimelineEntry.query.get(entry_id)
    if not entry:
        return None, 'Entry not found'
    
    timeline = Timeline.query.get(entry.timeline_id)
    if not timeline:
        return None, 'Timeline not found'
    
    project = Project.query.get(timeline.project_id)
    if not project:
        return None, 'Project not found'
    
    # Check if user has access
    member = ProjectMember.query.filter_by(
        project_id=project.id,
        user_id=user_id
    ).first()
    
    if not member:
        return None, 'Access denied'
    
    return entry, None

@bp.route('/timeline-entries/<int:entry_id>/links', methods=['GET'])
@jwt_required()
def list_entry_links(entry_id):
    """Get all links for a timeline entry (both incoming and outgoing)."""
    user_id = get_jwt_identity()
    
    # Check access
    entry, error = check_entry_access(user_id, entry_id)
    if error:
        return jsonify({'error': error}), 403 if error == 'Access denied' else 404
    
    # Get outgoing and incoming links
    outgoing = EntryLink.query.filter_by(from_entry_id=entry_id).all()
    incoming = EntryLink.query.filter_by(to_entry_id=entry_id).all()
    
    return jsonify({
        'outgoing_links': [link.to_dict() for link in outgoing],
        'incoming_links': [link.to_dict() for link in incoming]
    }), 200

@bp.route('/entry-links', methods=['POST'])
@jwt_required()
def create_entry_link():
    """Create a new link between timeline entries."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('from_entry_id') or not data.get('to_entry_id'):
        return jsonify({'error': 'from_entry_id and to_entry_id are required'}), 400
    
    if not data.get('link_type'):
        return jsonify({'error': 'link_type is required'}), 400
    
    # Check access to both entries
    from_entry, error = check_entry_access(user_id, data['from_entry_id'])
    if error:
        return jsonify({'error': f'From entry: {error}'}), 403 if error == 'Access denied' else 404
    
    to_entry, error = check_entry_access(user_id, data['to_entry_id'])
    if error:
        return jsonify({'error': f'To entry: {error}'}), 403 if error == 'Access denied' else 404
    
    # Prevent self-links
    if data['from_entry_id'] == data['to_entry_id']:
        return jsonify({'error': 'Cannot link an entry to itself'}), 400
    
    # Validate link type
    valid_types = ['relates_to', 'caused_by', 'leads_to', 'contradicts', 'supports', 'precedes', 'follows']
    if data['link_type'] not in valid_types:
        return jsonify({'error': f'Invalid link_type. Must be one of: {", ".join(valid_types)}'}), 400
    
    # Create link
    link = EntryLink(
        from_entry_id=data['from_entry_id'],
        to_entry_id=data['to_entry_id'],
        link_type=data['link_type'],
        description=data.get('description'),
        created_by=user_id
    )
    
    db.session.add(link)
    db.session.commit()
    
    return jsonify({'entry_link': link.to_dict()}), 201

@bp.route('/entry-links/bulk', methods=['POST'])
@jwt_required()
def create_entry_links_bulk():
    """Create multiple links from one entry to multiple entries."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data.get('from_entry_id'):
        return jsonify({'error': 'from_entry_id is required'}), 400
    
    if not data.get('to_entry_ids') or not isinstance(data['to_entry_ids'], list):
        return jsonify({'error': 'to_entry_ids must be a non-empty array'}), 400
    
    if len(data['to_entry_ids']) == 0:
        return jsonify({'error': 'to_entry_ids cannot be empty'}), 400
    
    if not data.get('link_type'):
        return jsonify({'error': 'link_type is required'}), 400
    
    # Validate link type
    valid_types = ['relates_to', 'caused_by', 'leads_to', 'contradicts', 'supports', 'precedes', 'follows']
    if data['link_type'] not in valid_types:
        return jsonify({'error': f'Invalid link_type. Must be one of: {", ".join(valid_types)}'}), 400
    
    # Check access to from_entry
    from_entry, error = check_entry_access(user_id, data['from_entry_id'])
    if error:
        return jsonify({'error': f'From entry: {error}'}), 403 if error == 'Access denied' else 404
    
    # Create links
    created_links = []
    errors = []
    
    for to_entry_id in data['to_entry_ids']:
        # Prevent self-links
        if data['from_entry_id'] == to_entry_id:
            errors.append({'to_entry_id': to_entry_id, 'error': 'Cannot link an entry to itself'})
            continue
        
        # Check access to to_entry
        to_entry, error = check_entry_access(user_id, to_entry_id)
        if error:
            errors.append({'to_entry_id': to_entry_id, 'error': error})
            continue
        
        # Check if link already exists
        existing_link = EntryLink.query.filter_by(
            from_entry_id=data['from_entry_id'],
            to_entry_id=to_entry_id,
            link_type=data['link_type']
        ).first()
        
        if existing_link:
            errors.append({'to_entry_id': to_entry_id, 'error': 'Link already exists'})
            continue
        
        # Create link
        link = EntryLink(
            from_entry_id=data['from_entry_id'],
            to_entry_id=to_entry_id,
            link_type=data['link_type'],
            description=data.get('description'),
            created_by=user_id
        )
        
        db.session.add(link)
        created_links.append(link)
    
    # Commit all links
    if created_links:
        db.session.commit()
    
    return jsonify({
        'created': len(created_links),
        'failed': len(errors),
        'entry_links': [link.to_dict() for link in created_links],
        'errors': errors
    }), 201 if created_links else 400

@bp.route('/entry-links/<int:link_id>', methods=['GET'])
@jwt_required()
def get_entry_link(link_id):
    """Get a specific entry link."""
    user_id = get_jwt_identity()
    
    link = EntryLink.query.get(link_id)
    if not link:
        return jsonify({'error': 'Link not found'}), 404
    
    # Check access to from_entry
    _, error = check_entry_access(user_id, link.from_entry_id)
    if error:
        return jsonify({'error': error}), 403 if error == 'Access denied' else 404
    
    return jsonify({'entry_link': link.to_dict()}), 200

@bp.route('/entry-links/<int:link_id>', methods=['PUT'])
@jwt_required()
def update_entry_link(link_id):
    """Update an entry link."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    link = EntryLink.query.get(link_id)
    if not link:
        return jsonify({'error': 'Link not found'}), 404
    
    # Check access
    _, error = check_entry_access(user_id, link.from_entry_id)
    if error:
        return jsonify({'error': error}), 403 if error == 'Access denied' else 404
    
    # Update fields
    if 'link_type' in data:
        valid_types = ['relates_to', 'caused_by', 'leads_to', 'contradicts', 'supports', 'precedes', 'follows']
        if data['link_type'] not in valid_types:
            return jsonify({'error': f'Invalid link_type. Must be one of: {", ".join(valid_types)}'}), 400
        link.link_type = data['link_type']
    
    if 'description' in data:
        link.description = data['description']
    
    db.session.commit()
    
    return jsonify({'entry_link': link.to_dict()}), 200

@bp.route('/entry-links/<int:link_id>', methods=['DELETE'])
@jwt_required()
def delete_entry_link(link_id):
    """Delete an entry link."""
    user_id = get_jwt_identity()
    
    link = EntryLink.query.get(link_id)
    if not link:
        return jsonify({'error': 'Link not found'}), 404
    
    # Check access
    _, error = check_entry_access(user_id, link.from_entry_id)
    if error:
        return jsonify({'error': error}), 403 if error == 'Access denied' else 404
    
    db.session.delete(link)
    db.session.commit()
    
    return jsonify({'message': 'Link deleted successfully'}), 200

@bp.route('/projects/<int:project_id>/entry-links', methods=['GET'])
@jwt_required()
def list_project_entry_links(project_id):
    """Get all entry links within a project."""
    user_id = get_jwt_identity()
    
    # Check project access
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    
    member = ProjectMember.query.filter_by(
        project_id=project_id,
        user_id=user_id
    ).first()
    
    if not member:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get all timeline IDs in this project
    timelines = Timeline.query.filter_by(project_id=project_id).all()
    timeline_ids = [t.id for t in timelines]
    
    # Get all entries in these timelines
    entries = TimelineEntry.query.filter(TimelineEntry.timeline_id.in_(timeline_ids)).all()
    entry_ids = [e.id for e in entries]
    
    # Get all links between these entries
    links = EntryLink.query.filter(
        EntryLink.from_entry_id.in_(entry_ids),
        EntryLink.to_entry_id.in_(entry_ids)
    ).all()
    
    return jsonify({
        'entry_links': [link.to_dict() for link in links],
        'total': len(links)
    }), 200
