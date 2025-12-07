"""API routes for IOC (Indicator of Compromise) management."""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import IOC, Project, ProjectMember, TimelineEntry, Timeline
from app.services.ioc_extractor import IOCExtractor
from functools import wraps
from datetime import datetime

bp = Blueprint('iocs', __name__)


def check_project_access(permission='read'):
    """Decorator to check if user has access to a project."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            project_id = kwargs.get('project_id') or request.json.get('project_id')
            
            if not project_id:
                return jsonify({'error': 'Project ID required'}), 400
            
            membership = ProjectMember.query.filter_by(
                user_id=user_id,
                project_id=project_id
            ).first()
            
            if not membership:
                return jsonify({'error': 'Access denied. You are not a member of this project.'}), 403
            
            permission_levels = {'read': 0, 'write': 1, 'admin': 2}
            user_level = permission_levels.get(membership.permissions, 0)
            required_level = permission_levels.get(permission, 0)
            
            if user_level < required_level:
                return jsonify({'error': f'Insufficient permissions. {permission} access required.'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ==================== IOC CRUD ====================

@bp.route('/projects/<int:project_id>/iocs', methods=['GET'])
@jwt_required()
@check_project_access(permission='read')
def list_iocs(project_id):
    """List all IOCs for a project with filtering."""
    # Get query parameters
    ioc_type = request.args.get('type')
    status = request.args.get('status')
    severity = request.args.get('severity')
    confidence = request.args.get('confidence')
    timeline_id = request.args.get('timeline_id', type=int)
    tags = request.args.getlist('tags')
    search = request.args.get('search')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    include_enrichment = request.args.get('include_enrichment', 'false').lower() == 'true'
    
    # Build query
    query = IOC.query.filter_by(project_id=project_id)
    
    if ioc_type:
        query = query.filter_by(ioc_type=ioc_type)
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    if confidence:
        query = query.filter_by(confidence=confidence)
    if timeline_id:
        query = query.filter_by(timeline_id=timeline_id)
    if search:
        query = query.filter(IOC.value.ilike(f'%{search}%'))
    if tags:
        # Filter by tags (array contains)
        for tag in tags:
            query = query.filter(IOC.tags.contains([tag]))
    
    # Order by last_seen descending
    query = query.order_by(IOC.last_seen.desc())
    
    # Paginate
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'iocs': [ioc.to_dict(include_enrichment=include_enrichment) for ioc in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages
    })


@bp.route('/projects/<int:project_id>/iocs', methods=['POST'])
@jwt_required()
@check_project_access(permission='write')
def create_ioc(project_id):
    """Create a new IOC."""
    data = request.json
    user_id = get_jwt_identity()
    
    # Validate required fields
    if not data.get('ioc_type') or not data.get('value'):
        return jsonify({'error': 'ioc_type and value are required'}), 400
    
    # Check if IOC already exists
    ioc, created = IOC.get_or_create(
        project_id=project_id,
        ioc_type=data['ioc_type'],
        value=data['value'],
        created_by=user_id,
        timeline_id=data.get('timeline_id'),
        entry_id=data.get('entry_id'),
        confidence=data.get('confidence', 'low'),
        severity=data.get('severity', 'info'),
        status=data.get('status', 'active'),
        description=data.get('description'),
        notes=data.get('notes'),
        tags=data.get('tags', []),
        source=data.get('source', 'manual')
    )
    
    if not created:
        # IOC exists, optionally update fields
        if data.get('notes'):
            ioc.notes = data['notes']
        if data.get('tags'):
            ioc.tags = list(set(ioc.tags or []) | set(data['tags']))
        db.session.commit()
        return jsonify({'message': 'IOC already exists', 'ioc': ioc.to_dict()}), 200
    
    db.session.add(ioc)
    db.session.commit()
    
    return jsonify(ioc.to_dict()), 201


@bp.route('/iocs/<int:ioc_id>', methods=['GET'])
@jwt_required()
def get_ioc(ioc_id):
    """Get a specific IOC."""
    user_id = get_jwt_identity()
    ioc = IOC.query.get(ioc_id)
    
    if not ioc:
        return jsonify({'error': 'IOC not found'}), 404
    
    # Check access
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=ioc.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    include_enrichment = request.args.get('include_enrichment', 'false').lower() == 'true'
    return jsonify(ioc.to_dict(include_enrichment=include_enrichment))


@bp.route('/iocs/<int:ioc_id>', methods=['PUT'])
@jwt_required()
def update_ioc(ioc_id):
    """Update an IOC."""
    user_id = get_jwt_identity()
    ioc = IOC.query.get(ioc_id)
    
    if not ioc:
        return jsonify({'error': 'IOC not found'}), 404
    
    # Check access
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=ioc.project_id
    ).first()
    
    if not membership or membership.permissions not in ['write', 'admin']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    data = request.json
    
    # Update fields
    if 'confidence' in data:
        ioc.confidence = data['confidence']
    if 'severity' in data:
        ioc.severity = data['severity']
    if 'status' in data:
        ioc.status = data['status']
    if 'description' in data:
        ioc.description = data['description']
    if 'notes' in data:
        ioc.notes = data['notes']
    if 'tags' in data:
        ioc.tags = data['tags']
    if 'enrichment_data' in data:
        # Merge with existing enrichment data
        if ioc.enrichment_data:
            ioc.enrichment_data.update(data['enrichment_data'])
        else:
            ioc.enrichment_data = data['enrichment_data']
    
    ioc.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(ioc.to_dict())


@bp.route('/iocs/<int:ioc_id>', methods=['DELETE'])
@jwt_required()
def delete_ioc(ioc_id):
    """Delete an IOC."""
    user_id = get_jwt_identity()
    ioc = IOC.query.get(ioc_id)
    
    if not ioc:
        return jsonify({'error': 'IOC not found'}), 404
    
    # Check access
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=ioc.project_id
    ).first()
    
    if not membership or membership.permissions not in ['write', 'admin']:
        return jsonify({'error': 'Insufficient permissions'}), 403
    
    db.session.delete(ioc)
    db.session.commit()
    
    return jsonify({'message': 'IOC deleted successfully'})


# ==================== IOC Extraction ====================

@bp.route('/projects/<int:project_id>/iocs/extract', methods=['POST'])
@jwt_required()
@check_project_access(permission='write')
def extract_iocs(project_id):
    """Extract IOCs from timeline entries."""
    data = request.json
    user_id = get_jwt_identity()
    
    entry_ids = data.get('entry_ids', [])
    timeline_id = data.get('timeline_id')
    auto_create = data.get('auto_create', True)
    
    if not entry_ids and not timeline_id:
        return jsonify({'error': 'entry_ids or timeline_id required'}), 400
    
    # Get entries
    query = TimelineEntry.query.join(Timeline).filter(Timeline.project_id == project_id)
    
    if entry_ids:
        query = query.filter(TimelineEntry.id.in_(entry_ids))
    elif timeline_id:
        query = query.filter(TimelineEntry.timeline_id == timeline_id)
    
    entries = query.all()
    
    if not entries:
        return jsonify({'error': 'No entries found'}), 404
    
    extracted_iocs = []
    created_count = 0
    existing_count = 0
    
    for entry in entries:
        # Extract IOCs from entry
        ioc_dict = IOCExtractor.extract_from_entry(entry.data or {})
        
        for ioc_type, values in ioc_dict.items():
            for value in values:
                if auto_create:
                    # Create or update IOC
                    ioc, created = IOC.get_or_create(
                        project_id=project_id,
                        ioc_type=ioc_type,
                        value=value,
                        created_by=user_id,
                        timeline_id=entry.timeline_id,
                        entry_id=entry.id,
                        source='auto_extracted',
                        confidence='low',
                        severity='info'
                    )
                    
                    if created:
                        db.session.add(ioc)
                        created_count += 1
                        extracted_iocs.append(ioc.to_dict())
                    else:
                        existing_count += 1
                else:
                    # Just return the extracted IOCs without creating
                    extracted_iocs.append({
                        'ioc_type': ioc_type,
                        'value': value,
                        'entry_id': entry.id,
                        'timeline_id': entry.timeline_id
                    })
    
    if auto_create:
        db.session.commit()
    
    return jsonify({
        'extracted': len(extracted_iocs),
        'created': created_count,
        'existing': existing_count,
        'iocs': extracted_iocs
    })


# ==================== Bulk Operations ====================

@bp.route('/projects/<int:project_id>/iocs/bulk', methods=['POST'])
@jwt_required()
@check_project_access(permission='write')
def bulk_update_iocs(project_id):
    """Bulk update IOCs."""
    data = request.json
    ioc_ids = data.get('ioc_ids', [])
    updates = data.get('updates', {})
    
    if not ioc_ids:
        return jsonify({'error': 'ioc_ids required'}), 400
    
    # Get IOCs
    iocs = IOC.query.filter(
        IOC.id.in_(ioc_ids),
        IOC.project_id == project_id
    ).all()
    
    updated_count = 0
    for ioc in iocs:
        if 'status' in updates:
            ioc.status = updates['status']
        if 'confidence' in updates:
            ioc.confidence = updates['confidence']
        if 'severity' in updates:
            ioc.severity = updates['severity']
        if 'tags' in updates:
            # Merge tags
            ioc.tags = list(set(ioc.tags or []) | set(updates['tags']))
        updated_count += 1
    
    db.session.commit()
    
    return jsonify({
        'message': f'Updated {updated_count} IOCs',
        'updated': updated_count
    })


@bp.route('/projects/<int:project_id>/iocs/stats', methods=['GET'])
@jwt_required()
@check_project_access(permission='read')
def get_ioc_stats(project_id):
    """Get IOC statistics for a project."""
    # Count by type
    type_counts = db.session.query(
        IOC.ioc_type,
        db.func.count(IOC.id)
    ).filter_by(project_id=project_id).group_by(IOC.ioc_type).all()
    
    # Count by severity
    severity_counts = db.session.query(
        IOC.severity,
        db.func.count(IOC.id)
    ).filter_by(project_id=project_id).group_by(IOC.severity).all()
    
    # Count by status
    status_counts = db.session.query(
        IOC.status,
        db.func.count(IOC.id)
    ).filter_by(project_id=project_id).group_by(IOC.status).all()
    
    # Total count
    total = IOC.query.filter_by(project_id=project_id).count()
    
    return jsonify({
        'total': total,
        'by_type': {t: c for t, c in type_counts},
        'by_severity': {s: c for s, c in severity_counts},
        'by_status': {st: c for st, c in status_counts}
    })
