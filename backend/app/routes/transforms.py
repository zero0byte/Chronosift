from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.transform import Transform
from app.utils.transform_parser import parse_file

bp = Blueprint('transforms', __name__)


@bp.route('/', methods=['GET'])
@jwt_required()
def list_transforms():
    """List transforms available to the user."""
    current_user_id = int(get_jwt_identity())
    
    # Get user's own transforms + public transforms
    transforms = Transform.query.filter(
        db.or_(
            Transform.created_by == current_user_id,
            Transform.is_public == True
        )
    ).order_by(Transform.created_at.desc()).all()
    
    return jsonify({
        'transforms': [t.to_dict() for t in transforms]
    }), 200


@bp.route('/', methods=['POST'])
@jwt_required()
def create_transform():
    """Create a new transform."""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    # Validate required fields
    if not data.get('name'):
        return jsonify({'error': 'Transform name is required'}), 400
    if not data.get('input_format'):
        return jsonify({'error': 'Input format is required'}), 400
    if not data.get('mapping'):
        return jsonify({'error': 'Mapping configuration is required'}), 400
    
    # Validate input format
    if data['input_format'] not in ['csv', 'json', 'xml']:
        return jsonify({'error': 'Invalid input format. Must be csv, json, or xml'}), 400
    
    # Validate mapping structure
    mapping = data['mapping']
    if not isinstance(mapping, dict) or 'fields' not in mapping:
        return jsonify({'error': 'Mapping must contain a "fields" array'}), 400
    
    transform = Transform(
        name=data['name'],
        description=data.get('description'),
        input_format=data['input_format'],
        mapping=mapping,
        created_by=current_user_id,
        team_id=data.get('team_id'),
        is_public=data.get('is_public', False),
        imported_via_api=data.get('imported_via_api', False)
    )
    
    db.session.add(transform)
    db.session.commit()
    
    return jsonify({
        'message': 'Transform created successfully',
        'transform': transform.to_dict()
    }), 201


@bp.route('/<int:transform_id>', methods=['GET'])
@jwt_required()
def get_transform(transform_id):
    """Get transform details."""
    current_user_id = int(get_jwt_identity())
    transform = Transform.query.get_or_404(transform_id)
    
    # Check access
    if not (transform.created_by == current_user_id or transform.is_public):
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'transform': transform.to_dict()
    }), 200


@bp.route('/<int:transform_id>', methods=['PUT'])
@jwt_required()
def update_transform(transform_id):
    """Update transform."""
    current_user_id = int(get_jwt_identity())
    transform = Transform.query.get_or_404(transform_id)
    
    # Only creator can update
    if transform.created_by != current_user_id:
        return jsonify({'error': 'Only the creator can update this transform'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        transform.name = data['name']
    if 'description' in data:
        transform.description = data['description']
    if 'mapping' in data:
        transform.mapping = data['mapping']
    if 'is_public' in data:
        transform.is_public = data['is_public']
    if 'team_id' in data:
        transform.team_id = data['team_id']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Transform updated successfully',
        'transform': transform.to_dict()
    }), 200


@bp.route('/<int:transform_id>', methods=['DELETE'])
@jwt_required()
def delete_transform(transform_id):
    """Delete transform."""
    current_user_id = int(get_jwt_identity())
    transform = Transform.query.get_or_404(transform_id)
    
    # Only creator can delete
    if transform.created_by != current_user_id:
        return jsonify({'error': 'Only the creator can delete this transform'}), 403
    
    db.session.delete(transform)
    db.session.commit()
    
    return jsonify({
        'message': 'Transform deleted successfully'
    }), 200


@bp.route('/<int:transform_id>/test', methods=['POST'])
@jwt_required()
def test_transform(transform_id):
    """Test a transform with sample data."""
    current_user_id = int(get_jwt_identity())
    transform = Transform.query.get_or_404(transform_id)
    
    # Check access
    if not (transform.created_by == current_user_id or transform.is_public):
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    
    if 'sample_data' not in data:
        return jsonify({'error': 'sample_data is required'}), 400
    
    try:
        # Parse the sample data
        results = parse_file(
            data['sample_data'],
            transform.input_format,
            transform.mapping
        )
        
        # Limit preview to first 50 records
        preview = results[:50]
        
        return jsonify({
            'success': True,
            'total_records': len(results),
            'preview': preview,
            'message': f'Successfully parsed {len(results)} records'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400


@bp.route('/test', methods=['POST'])
@jwt_required()
def test_transform_inline():
    """Test a transform mapping without saving it."""
    data = request.get_json()
    
    if 'mapping' not in data:
        return jsonify({'error': 'mapping is required'}), 400
    if 'input_format' not in data:
        return jsonify({'error': 'input_format is required'}), 400
    if 'sample_data' not in data:
        return jsonify({'error': 'sample_data is required'}), 400
    
    try:
        # Parse the sample data
        results = parse_file(
            data['sample_data'],
            data['input_format'],
            data['mapping']
        )
        
        # Limit preview to first 50 records
        preview = results[:50]
        
        return jsonify({
            'success': True,
            'total_records': len(results),
            'preview': preview,
            'message': f'Successfully parsed {len(results)} records'
        }), 200
    
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
