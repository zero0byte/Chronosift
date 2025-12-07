from datetime import datetime
from app import db

class AttackChain(db.Model):
    """
    Attack Chain - Visual representation of attack progression
    Links key timestamps together to tell the investigation story
    """
    __tablename__ = 'attack_chains'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = db.relationship('Project', backref='attack_chains')
    creator = db.relationship('User', backref='attack_chains')
    nodes = db.relationship('AttackChainNode', back_populates='chain', cascade='all, delete-orphan', order_by='AttackChainNode.order')
    
    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'name': self.name,
            'description': self.description,
            'created_by': self.created_by,
            'creator_name': self.creator.full_name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'node_count': len(self.nodes) if self.nodes else 0
        }
    
    def to_dict_full(self):
        """Full representation including nodes and edges"""
        data = self.to_dict()
        data['nodes'] = [node.to_dict() for node in self.nodes] if self.nodes else []
        return data


class AttackChainNode(db.Model):
    """
    Attack Chain Node - Represents a key timestamp in the attack chain
    """
    __tablename__ = 'attack_chain_nodes'
    
    id = db.Column(db.Integer, primary_key=True)
    chain_id = db.Column(db.Integer, db.ForeignKey('attack_chains.id', ondelete='CASCADE'), nullable=False)
    key_timestamp_id = db.Column(db.Integer, db.ForeignKey('key_timestamps.id', ondelete='CASCADE'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0)  # Position in chain
    
    # Node display properties
    x_position = db.Column(db.Float, default=0)  # Canvas X coordinate
    y_position = db.Column(db.Float, default=0)  # Canvas Y coordinate
    
    # MITRE ATT&CK mapping
    mitre_tactic = db.Column(db.String(100))  # e.g., "Initial Access"
    mitre_technique = db.Column(db.String(100))  # e.g., "T1566 - Phishing"
    mitre_subtechnique = db.Column(db.String(100))  # e.g., "T1566.001 - Spearphishing Attachment"
    
    # Additional context
    notes = db.Column(db.Text)  # Investigation notes for this node
    severity = db.Column(db.String(20), default='medium')  # low, medium, high, critical
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    chain = db.relationship('AttackChain', back_populates='nodes')
    key_timestamp = db.relationship('KeyTimestamp', backref='chain_nodes')
    outgoing_edges = db.relationship('AttackChainEdge', foreign_keys='AttackChainEdge.from_node_id', back_populates='from_node', cascade='all, delete-orphan')
    incoming_edges = db.relationship('AttackChainEdge', foreign_keys='AttackChainEdge.to_node_id', back_populates='to_node', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'chain_id': self.chain_id,
            'key_timestamp_id': self.key_timestamp_id,
            'order': self.order,
            'x_position': self.x_position,
            'y_position': self.y_position,
            'mitre_tactic': self.mitre_tactic,
            'mitre_technique': self.mitre_technique,
            'mitre_subtechnique': self.mitre_subtechnique,
            'notes': self.notes,
            'severity': self.severity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            # Include key timestamp data
            'key_timestamp': self.key_timestamp.to_dict() if self.key_timestamp else None,
            # Include edges
            'outgoing_edges': [edge.to_dict() for edge in self.outgoing_edges] if self.outgoing_edges else [],
            'incoming_edges': [edge.to_dict() for edge in self.incoming_edges] if self.incoming_edges else []
        }


class AttackChainEdge(db.Model):
    """
    Attack Chain Edge - Represents a relationship between two nodes
    """
    __tablename__ = 'attack_chain_edges'
    
    id = db.Column(db.Integer, primary_key=True)
    from_node_id = db.Column(db.Integer, db.ForeignKey('attack_chain_nodes.id', ondelete='CASCADE'), nullable=False)
    to_node_id = db.Column(db.Integer, db.ForeignKey('attack_chain_nodes.id', ondelete='CASCADE'), nullable=False)
    
    # Edge properties
    relationship_type = db.Column(db.String(50), default='leads_to')  # leads_to, causes, enables, blocks
    label = db.Column(db.String(200))  # Optional label for the edge
    confidence = db.Column(db.String(20), default='high')  # low, medium, high
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    from_node = db.relationship('AttackChainNode', foreign_keys=[from_node_id], back_populates='outgoing_edges')
    to_node = db.relationship('AttackChainNode', foreign_keys=[to_node_id], back_populates='incoming_edges')
    
    def to_dict(self):
        return {
            'id': self.id,
            'from_node_id': self.from_node_id,
            'to_node_id': self.to_node_id,
            'relationship_type': self.relationship_type,
            'label': self.label,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
