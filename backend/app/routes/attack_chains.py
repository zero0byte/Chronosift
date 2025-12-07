from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import AttackChain, AttackChainNode, AttackChainEdge, KeyTimestamp, Project, ProjectMember
from app.utils.permissions import require_project_permission

bp = Blueprint('attack_chains', __name__)


@bp.route('/projects/<int:project_id>/attack-chains', methods=['GET'])
@jwt_required()
@require_project_permission('read')
def list_attack_chains(project_id):
    """List all attack chains for a project."""
    chains = AttackChain.query.filter_by(project_id=project_id).all()
    
    return jsonify({
        'attack_chains': [chain.to_dict() for chain in chains],
        'total': len(chains)
    }), 200


@bp.route('/projects/<int:project_id>/attack-chains', methods=['POST'])
@jwt_required()
@require_project_permission('write')
def create_attack_chain(project_id):
    """Create a new attack chain."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    chain = AttackChain(
        project_id=project_id,
        name=name,
        description=data.get('description', ''),
        created_by=user_id
    )
    
    db.session.add(chain)
    db.session.commit()
    
    return jsonify({
        'message': 'Attack chain created successfully',
        'attack_chain': chain.to_dict()
    }), 201


@bp.route('/attack-chains/<int:chain_id>', methods=['GET'])
@jwt_required()
def get_attack_chain(chain_id):
    """Get attack chain with full node and edge data."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({
        'attack_chain': chain.to_dict_full()
    }), 200


@bp.route('/attack-chains/<int:chain_id>', methods=['PUT'])
@jwt_required()
def update_attack_chain(chain_id):
    """Update attack chain metadata."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if 'name' in data:
        chain.name = data['name']
    if 'description' in data:
        chain.description = data['description']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Attack chain updated successfully',
        'attack_chain': chain.to_dict()
    }), 200


@bp.route('/attack-chains/<int:chain_id>', methods=['DELETE'])
@jwt_required()
def delete_attack_chain(chain_id):
    """Delete an attack chain."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(chain)
    db.session.commit()
    
    return jsonify({
        'message': 'Attack chain deleted successfully'
    }), 200


# ==================== Node Operations ====================

@bp.route('/attack-chains/<int:chain_id>/nodes', methods=['POST'])
@jwt_required()
def add_node_to_chain(chain_id):
    """Add a key timestamp as a node to the attack chain."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    key_timestamp_id = data.get('key_timestamp_id')
    
    if not key_timestamp_id:
        return jsonify({'error': 'key_timestamp_id is required'}), 400
    
    # Verify key timestamp exists and belongs to same project
    key_timestamp = KeyTimestamp.query.get_or_404(key_timestamp_id)
    if key_timestamp.project_id != chain.project_id:
        return jsonify({'error': 'Key timestamp does not belong to this project'}), 400
    
    # Check if already exists
    existing = AttackChainNode.query.filter_by(
        chain_id=chain_id,
        key_timestamp_id=key_timestamp_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Key timestamp already exists in this chain'}), 400
    
    # Get next order number
    max_order = db.session.query(db.func.max(AttackChainNode.order)).filter_by(chain_id=chain_id).scalar() or -1
    
    node = AttackChainNode(
        chain_id=chain_id,
        key_timestamp_id=key_timestamp_id,
        order=max_order + 1,
        x_position=data.get('x_position', 0),
        y_position=data.get('y_position', 0),
        mitre_tactic=data.get('mitre_tactic'),
        mitre_technique=data.get('mitre_technique'),
        mitre_subtechnique=data.get('mitre_subtechnique'),
        notes=data.get('notes', ''),
        severity=data.get('severity', 'medium')
    )
    
    db.session.add(node)
    db.session.commit()
    
    return jsonify({
        'message': 'Node added to attack chain',
        'node': node.to_dict()
    }), 201


@bp.route('/attack-chain-nodes/<int:node_id>', methods=['PUT'])
@jwt_required()
def update_chain_node(node_id):
    """Update attack chain node properties."""
    node = AttackChainNode.query.get_or_404(node_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=node.chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and node.chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    # Update position
    if 'x_position' in data:
        node.x_position = data['x_position']
    if 'y_position' in data:
        node.y_position = data['y_position']
    
    # Update MITRE mapping
    if 'mitre_tactic' in data:
        node.mitre_tactic = data['mitre_tactic']
    if 'mitre_technique' in data:
        node.mitre_technique = data['mitre_technique']
    if 'mitre_subtechnique' in data:
        node.mitre_subtechnique = data['mitre_subtechnique']
    
    # Update metadata
    if 'notes' in data:
        node.notes = data['notes']
    if 'severity' in data:
        node.severity = data['severity']
    if 'order' in data:
        node.order = data['order']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Node updated successfully',
        'node': node.to_dict()
    }), 200


@bp.route('/attack-chain-nodes/<int:node_id>', methods=['DELETE'])
@jwt_required()
def delete_chain_node(node_id):
    """Remove a node from the attack chain."""
    node = AttackChainNode.query.get_or_404(node_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=node.chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and node.chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(node)
    db.session.commit()
    
    return jsonify({
        'message': 'Node removed from attack chain'
    }), 200


# ==================== Edge Operations ====================

@bp.route('/attack-chains/<int:chain_id>/edges', methods=['POST'])
@jwt_required()
def add_edge_to_chain(chain_id):
    """Create an edge between two nodes."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    from_node_id = data.get('from_node_id')
    to_node_id = data.get('to_node_id')
    
    if not from_node_id or not to_node_id:
        return jsonify({'error': 'from_node_id and to_node_id are required'}), 400
    
    # Verify nodes exist and belong to this chain
    from_node = AttackChainNode.query.get_or_404(from_node_id)
    to_node = AttackChainNode.query.get_or_404(to_node_id)
    
    if from_node.chain_id != chain_id or to_node.chain_id != chain_id:
        return jsonify({'error': 'Nodes must belong to this chain'}), 400
    
    # Check if edge already exists
    existing = AttackChainEdge.query.filter_by(
        from_node_id=from_node_id,
        to_node_id=to_node_id
    ).first()
    
    if existing:
        return jsonify({'error': 'Edge already exists'}), 400
    
    edge = AttackChainEdge(
        from_node_id=from_node_id,
        to_node_id=to_node_id,
        relationship_type=data.get('relationship_type', 'leads_to'),
        label=data.get('label', ''),
        confidence=data.get('confidence', 'high')
    )
    
    db.session.add(edge)
    db.session.commit()
    
    return jsonify({
        'message': 'Edge created successfully',
        'edge': edge.to_dict()
    }), 201


@bp.route('/attack-chain-edges/<int:edge_id>', methods=['PUT'])
@jwt_required()
def update_chain_edge(edge_id):
    """Update edge properties."""
    edge = AttackChainEdge.query.get_or_404(edge_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=edge.from_node.chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and edge.from_node.chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    if 'relationship_type' in data:
        edge.relationship_type = data['relationship_type']
    if 'label' in data:
        edge.label = data['label']
    if 'confidence' in data:
        edge.confidence = data['confidence']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Edge updated successfully',
        'edge': edge.to_dict()
    }), 200


@bp.route('/attack-chain-edges/<int:edge_id>', methods=['DELETE'])
@jwt_required()
def delete_chain_edge(edge_id):
    """Delete an edge."""
    edge = AttackChainEdge.query.get_or_404(edge_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=edge.from_node.chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and edge.from_node.chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    db.session.delete(edge)
    db.session.commit()
    
    return jsonify({
        'message': 'Edge deleted successfully'
    }), 200


# ==================== Export Operations ====================

@bp.route('/attack-chains/<int:chain_id>/export/mitre-navigator', methods=['GET'])
@jwt_required()
def export_mitre_navigator(chain_id):
    """Export attack chain as MITRE ATT&CK Navigator layer."""
    chain = AttackChain.query.get_or_404(chain_id)
    user_id = get_jwt_identity()
    
    # Check permissions
    is_member = ProjectMember.query.filter_by(
        project_id=chain.project_id,
        user_id=user_id
    ).first()
    
    if not is_member and chain.project.created_by != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Build MITRE Navigator layer JSON
    techniques = []
    for node in chain.nodes:
        if node.mitre_technique:
            # Extract technique ID (e.g., "T1566" from "T1566 - Phishing")
            technique_id = node.mitre_technique.split(' ')[0] if ' ' in node.mitre_technique else node.mitre_technique
            
            techniques.append({
                'techniqueID': technique_id,
                'tactic': node.mitre_tactic.lower().replace(' ', '-') if node.mitre_tactic else '',
                'color': node.key_timestamp.color if node.key_timestamp else '#2563EB',
                'comment': node.notes or node.key_timestamp.description if node.key_timestamp else '',
                'enabled': True,
                'score': 1
            })
    
    layer = {
        'name': chain.name,
        'versions': {
            'attack': '13',
            'navigator': '4.8',
            'layer': '4.4'
        },
        'domain': 'enterprise-attack',
        'description': chain.description or '',
        'techniques': techniques,
        'gradient': {
            'colors': ['#ffffff', '#ff0000'],
            'minValue': 0,
            'maxValue': 1
        },
        'legendItems': [],
        'metadata': [],
        'showTacticRowBackground': False,
        'tacticRowBackground': '#dddddd',
        'selectTechniquesAcrossTactics': True
    }
    
    return jsonify(layer), 200
