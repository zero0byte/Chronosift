import { useState, useRef, useEffect } from 'react';
import { attackChainsAPI } from '../lib/api';
import { MITRE_TACTICS } from './MitreTacticsSelect';

interface KeyTimestamp {
  id: number;
  timestamp: string;
  label: string;
  description?: string;
  color: string;
}

interface ChainNode {
  id: number;
  chain_id: number;
  key_timestamp_id: number;
  order: number;
  x_position: number;
  y_position: number;
  mitre_tactic?: string;
  mitre_technique?: string;
  mitre_subtechnique?: string;
  notes?: string;
  severity: string;
  key_timestamp: KeyTimestamp;
  outgoing_edges: ChainEdge[];
  incoming_edges: ChainEdge[];
}

interface ChainEdge {
  id: number;
  from_node_id: number;
  to_node_id: number;
  relationship_type: string;
  label?: string;
  confidence: string;
}

interface AttackChain {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  node_count: number;
  nodes?: ChainNode[];
}

interface AttackChainBuilderProps {
  projectId: number;
  chainId?: number;
  availableTimestamps: KeyTimestamp[];
  onClose?: () => void;
}

const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

export default function AttackChainBuilder({ projectId, chainId, availableTimestamps, onClose }: AttackChainBuilderProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [chain, setChain] = useState<AttackChain | null>(null);
  const [nodes, setNodes] = useState<ChainNode[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Canvas state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Node interaction
  const [selectedNode, setSelectedNode] = useState<ChainNode | null>(null);
  const [draggingNode, setDraggingNode] = useState<ChainNode | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Edge creation
  const [connectingFrom, setConnectingFrom] = useState<ChainNode | null>(null);
  const [tempEdgeEnd, setTempEdgeEnd] = useState<{ x: number; y: number } | null>(null);
  
  // Modals
  const [showAddNode, setShowAddNode] = useState(false);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // Node editor form state
  const [selectedTactic, setSelectedTactic] = useState<string>('');
  const [selectedTechnique, setSelectedTechnique] = useState<string>('');
  const [availableTechniques, setAvailableTechniques] = useState<Array<{id: string, name: string, subs: string[]}>>([]);
  const [availableSubtechniques, setAvailableSubtechniques] = useState<string[]>([]);

  useEffect(() => {
    if (chainId) {
      loadChain();
    }
  }, [chainId]);

  const loadChain = async () => {
    if (!chainId) return;
    try {
      setLoading(true);
      const response = await attackChainsAPI.get(chainId);
      const chainData = response.data.attack_chain;
      setChain(chainData);
      setNodes(chainData.nodes || []);
    } catch (error) {
      console.error('Failed to load attack chain:', error);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Canvas Controls ====================
  
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.3, Math.min(3, prev * delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle mouse or Alt+Left
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    } else if (draggingNode) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const x = (e.clientX - rect.left - panOffset.x - dragOffset.x) / zoom;
      const y = (e.clientY - rect.top - panOffset.y - dragOffset.y) / zoom;
      
      setNodes(prev => prev.map(node => 
        node.id === draggingNode.id 
          ? { ...node, x_position: x, y_position: y }
          : node
      ));
    } else if (connectingFrom) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      setTempEdgeEnd({
        x: (e.clientX - rect.left - panOffset.x) / zoom,
        y: (e.clientY - rect.top - panOffset.y) / zoom
      });
    }
  };

  const handleMouseUp = async () => {
    if (draggingNode) {
      // Save position to backend
      try {
        await attackChainsAPI.updateNode(draggingNode.id, {
          x_position: draggingNode.x_position,
          y_position: draggingNode.y_position
        });
      } catch (error) {
        console.error('Failed to update node position:', error);
      }
      setDraggingNode(null);
    }
    setIsPanning(false);
    setTempEdgeEnd(null);
  };

  // ==================== Node Operations ====================
  
  const handleNodeMouseDown = (node: ChainNode, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Shift+Click: Start connecting
      setConnectingFrom(node);
    } else {
      // Normal click: Start dragging
      setDraggingNode(node);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      setDragOffset({
        x: (e.clientX - rect.left - panOffset.x) / zoom - node.x_position,
        y: (e.clientY - rect.top - panOffset.y) / zoom - node.y_position
      });
    }
  };

  const handleNodeClick = (node: ChainNode, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (connectingFrom && connectingFrom.id !== node.id) {
      // Complete edge connection
      createEdge(connectingFrom, node);
      setConnectingFrom(null);
    } else if (!e.shiftKey) {
      setSelectedNode(node);
    }
  };
  
  const handleNodeDoubleClick = (node: ChainNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
    
    // Initialize form state from node data
    const tacticName = node.mitre_tactic || '';
    const tactic = MITRE_TACTICS.find(t => t.name === tacticName);
    
    setSelectedTactic(tacticName);
    setSelectedTechnique(node.mitre_technique || '');
    
    if (tactic) {
      setAvailableTechniques(tactic.techniques || []);
      
      if (node.mitre_technique) {
        const technique = tactic.techniques.find(t => t.id === node.mitre_technique);
        setAvailableSubtechniques(technique?.subs || []);
      }
    }
    
    setShowNodeEditor(true);
  };
  
  const updateNode = async (nodeId: number, updates: Partial<ChainNode>) => {
    try {
      await attackChainsAPI.updateNode(nodeId, updates);
      await loadChain();
      setShowNodeEditor(false);
    } catch (error) {
      alert('Failed to update node');
    }
  };

  const addNodeToChain = async (timestampId: number, position?: { x: number; y: number }) => {
    if (!chainId) return;
    
    try {
      const response = await attackChainsAPI.addNode(chainId, {
        key_timestamp_id: timestampId,
        x_position: position?.x || 100,
        y_position: position?.y || 100,
        severity: 'medium'
      });
      
      await loadChain();
      setShowAddNode(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add node');
    }
  };

  const removeNode = async (nodeId: number) => {
    if (!window.confirm('Remove this node from the chain?')) return;
    
    try {
      await attackChainsAPI.deleteNode(nodeId);
      await loadChain();
      setSelectedNode(null);
    } catch (error) {
      alert('Failed to remove node');
    }
  };

  // ==================== Edge Operations ====================
  
  const createEdge = async (from: ChainNode, to: ChainNode) => {
    if (!chainId) return;
    
    try {
      await attackChainsAPI.addEdge(chainId, {
        from_node_id: from.id,
        to_node_id: to.id,
        relationship_type: 'leads_to',
        confidence: 'high'
      });
      
      await loadChain();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create edge');
    }
  };

  const removeEdge = async (edgeId: number) => {
    try {
      await attackChainsAPI.deleteEdge(edgeId);
      await loadChain();
    } catch (error) {
      alert('Failed to remove edge');
    }
  };

  // ==================== Auto Layout ====================
  
  const autoLayout = () => {
    if (nodes.length === 0) return;
    
    // Sort by timestamp
    const sorted = [...nodes].sort((a, b) => 
      new Date(a.key_timestamp.timestamp).getTime() - new Date(b.key_timestamp.timestamp).getTime()
    );
    
    // Arrange in rows based on MITRE tactic
    const tacticGroups: Record<string, ChainNode[]> = {};
    sorted.forEach(node => {
      const tactic = node.mitre_tactic || 'Uncategorized';
      if (!tacticGroups[tactic]) tacticGroups[tactic] = [];
      tacticGroups[tactic].push(node);
    });
    
    let yOffset = 50;
    const updates: Promise<any>[] = [];
    
    Object.entries(tacticGroups).forEach(([tactic, groupNodes]) => {
      groupNodes.forEach((node, idx) => {
        const x = 50 + idx * (NODE_WIDTH + 80);
        const y = yOffset;
        
        updates.push(attackChainsAPI.updateNode(node.id, { x_position: x, y_position: y }));
      });
      yOffset += NODE_HEIGHT + 100;
    });
    
    Promise.all(updates).then(() => loadChain());
  };

  // ==================== Export ====================
  
  const exportMitreNavigator = async () => {
    if (!chainId) return;
    
    try {
      const response = await attackChainsAPI.exportMitreNavigator(chainId);
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${chain?.name || 'attack-chain'}-mitre-navigator.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to export');
    }
  };

  // ==================== Render ====================
  
  const renderNode = (node: ChainNode) => {
    const isSelected = selectedNode?.id === node.id;
    const isDragging = draggingNode?.id === node.id;
    
    return (
      <g
        key={node.id}
        transform={`translate(${node.x_position}, ${node.y_position})`}
        onMouseDown={(e) => handleNodeMouseDown(node, e as any)}
        onClick={(e) => handleNodeClick(node, e as any)}
        onDoubleClick={(e) => handleNodeDoubleClick(node, e as any)}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Node rectangle */}
        <rect
          width={NODE_WIDTH}
          height={NODE_HEIGHT}
          fill="white"
          stroke={isSelected ? '#E94B8B' : node.key_timestamp.color}
          strokeWidth={isSelected ? 3 : 2}
          rx={8}
          style={{
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
            opacity: isDragging ? 0.7 : 1
          }}
        />
        
        {/* Color bar */}
        <rect
          width={NODE_WIDTH}
          height={8}
          fill={node.key_timestamp.color}
          rx={8}
        />
        
        {/* Label */}
        <text
          x={NODE_WIDTH / 2}
          y={30}
          textAnchor="middle"
          fontSize="14"
          fontWeight="600"
          fill="#111827"
        >
          {node.key_timestamp.label.substring(0, 20)}
        </text>
        
        {/* Timestamp */}
        <text
          x={NODE_WIDTH / 2}
          y={48}
          textAnchor="middle"
          fontSize="10"
          fill="#6B7280"
          fontFamily="monospace"
        >
          {new Date(node.key_timestamp.timestamp).toLocaleString().substring(0, 16)}
        </text>
        
        {/* MITRE Tactic */}
        {node.mitre_tactic && (
          <text
            x={NODE_WIDTH / 2}
            y={68}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#9333EA"
          >
            {node.mitre_tactic}
          </text>
        )}
        
        {/* MITRE Technique */}
        {node.mitre_technique && (
          <text
            x={NODE_WIDTH / 2}
            y={node.mitre_tactic ? 83 : 68}
            textAnchor="middle"
            fontSize="9"
            fill="#6B7280"
          >
            {node.mitre_technique}{node.mitre_subtechnique ? `.${node.mitre_subtechnique.split('.')[1]}` : ''}
          </text>
        )}
        
        {/* Severity badge */}
        <circle
          cx={NODE_WIDTH - 20}
          cy={20}
          r={8}
          fill={
            node.severity === 'critical' ? '#DC2626' :
            node.severity === 'high' ? '#F59E0B' :
            node.severity === 'medium' ? '#FCD34D' : '#10B981'
          }
        />
        
        {/* Connection points */}
        <circle cx={NODE_WIDTH / 2} cy={0} r={6} fill="#2563EB" opacity={0.5} />
        <circle cx={NODE_WIDTH / 2} cy={NODE_HEIGHT} r={6} fill="#2563EB" opacity={0.5} />
      </g>
    );
  };

  const renderEdge = (edge: ChainEdge) => {
    const fromNode = nodes.find(n => n.id === edge.from_node_id);
    const toNode = nodes.find(n => n.id === edge.to_node_id);
    
    if (!fromNode || !toNode) return null;
    
    const x1 = fromNode.x_position + NODE_WIDTH / 2;
    const y1 = fromNode.y_position + NODE_HEIGHT;
    const x2 = toNode.x_position + NODE_WIDTH / 2;
    const y2 = toNode.y_position;
    
    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowSize = 12;
    
    return (
      <g key={edge.id}>
        {/* Line */}
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={
            edge.relationship_type === 'causes' ? '#DC2626' :
            edge.relationship_type === 'enables' ? '#10B981' :
            edge.relationship_type === 'blocks' ? '#6B7280' : '#2563EB'
          }
          strokeWidth={2}
          strokeDasharray={edge.confidence === 'low' ? '5,5' : undefined}
          markerEnd="url(#arrowhead)"
        />
        
        {/* Label */}
        {edge.label && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 10}
            textAnchor="middle"
            fontSize="10"
            fill="#374151"
            style={{ background: 'white', padding: '2px 4px' }}
          >
            {edge.label}
          </text>
        )}
        
        {/* Delete button (on hover) */}
        <circle
          cx={(x1 + x2) / 2}
          cy={(y1 + y2) / 2}
          r={10}
          fill="white"
          stroke="#DC2626"
          strokeWidth={2}
          opacity={0}
          style={{ cursor: 'pointer' }}
          onClick={() => removeEdge(edge.id)}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
        />
      </g>
    );
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading attack chain...</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F9FAFB' }}>
      {/* Toolbar */}
      <div style={{
        padding: '16px 24px',
        background: 'white',
        borderBottom: '2px solid var(--gray-200)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>{chain?.name || 'Attack Chain'}</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            {nodes.length} nodes • Double-click to edit • Shift+Click to connect • Alt+Drag to pan
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAddNode(true)}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            + Add Node
          </button>
          
          <button
            onClick={autoLayout}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            📐 Auto Layout
          </button>
          
          <button
            onClick={exportMitreNavigator}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-purple, #9333EA)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            📥 Export MITRE
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'var(--gray-200)',
                color: 'var(--gray-700)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          cursor: isPanning ? 'grabbing' : connectingFrom ? 'crosshair' : 'default',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 19px, #E5E7EB 19px, #E5E7EB 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #E5E7EB 19px, #E5E7EB 20px)'
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#2563EB" />
            </marker>
          </defs>
          
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`}>
            {/* Render edges first (behind nodes) */}
            {nodes.flatMap(node => node.outgoing_edges.map(edge => renderEdge(edge)))}
            
            {/* Temporary edge while connecting */}
            {connectingFrom && tempEdgeEnd && (
              <line
                x1={connectingFrom.x_position + NODE_WIDTH / 2}
                y1={connectingFrom.y_position + NODE_HEIGHT}
                x2={tempEdgeEnd.x}
                y2={tempEdgeEnd.y}
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="5,5"
                opacity={0.6}
              />
            )}
            
            {/* Render nodes */}
            {nodes.map(node => renderNode(node))}
          </g>
        </svg>
        
        {/* Empty state */}
        {nodes.length === 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔗</div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '8px' }}>
              Start Building Your Attack Chain
            </h3>
            <p style={{ color: 'var(--gray-600)', marginBottom: '24px' }}>
              Add key timestamps to visualize the attack progression
            </p>
            <button
              onClick={() => setShowAddNode(true)}
              style={{
                padding: '12px 24px',
                background: 'var(--accent-green)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 600
              }}
            >
              + Add First Node
            </button>
          </div>
        )}
      </div>

      {/* Node Editor Modal */}
      {showNodeEditor && selectedNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowNodeEditor(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Edit Node</h3>
              <button
                onClick={() => removeNode(selectedNode.id)}
                style={{
                  padding: '6px 12px',
                  background: '#DC2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                🗑️ Delete Node
              </button>
            </div>
            
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateNode(selectedNode.id, {
                  mitre_tactic: formData.get('mitre_tactic') as string || undefined,
                  mitre_technique: formData.get('mitre_technique') as string || undefined,
                  mitre_subtechnique: formData.get('mitre_subtechnique') as string || undefined,
                  notes: formData.get('notes') as string || undefined,
                  severity: formData.get('severity') as string
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              {/* Key Timestamp Info (Read-only) */}
              <div style={{
                padding: '16px',
                background: '#F3F4F6',
                borderRadius: '8px',
                borderLeft: `4px solid ${selectedNode.key_timestamp.color}`
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{selectedNode.key_timestamp.label}</div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                  {new Date(selectedNode.key_timestamp.timestamp).toLocaleString()}
                </div>
                {selectedNode.key_timestamp.description && (
                  <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '8px' }}>
                    {selectedNode.key_timestamp.description}
                  </div>
                )}
              </div>
              
              {/* MITRE Tactic */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  MITRE ATT&CK Tactic
                </label>
                <select
                  name="mitre_tactic"
                  value={selectedTactic}
                  onChange={(e) => {
                    const tacticName = e.target.value;
                    setSelectedTactic(tacticName);
                    setSelectedTechnique('');
                    setAvailableSubtechniques([]);
                    
                    const tactic = MITRE_TACTICS.find(t => t.name === tacticName);
                    setAvailableTechniques(tactic?.techniques || []);
                  }}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">-- Select Tactic --</option>
                  {MITRE_TACTICS.map(tactic => (
                    <option key={tactic.id} value={tactic.name}>{tactic.name}</option>
                  ))}
                </select>
              </div>
              
              {/* MITRE Technique */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  MITRE Technique
                </label>
                <select
                  name="mitre_technique"
                  value={selectedTechnique}
                  onChange={(e) => {
                    const techniqueId = e.target.value;
                    setSelectedTechnique(techniqueId);
                    
                    const technique = availableTechniques.find(t => t.id === techniqueId);
                    setAvailableSubtechniques(technique?.subs || []);
                  }}
                  disabled={!selectedTactic}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    backgroundColor: !selectedTactic ? '#F3F4F6' : '#fff'
                  }}
                >
                  <option value="">{selectedTactic ? '-- Select Technique --' : '-- Select Tactic First --'}</option>
                  {availableTechniques.map(technique => (
                    <option key={technique.id} value={technique.id}>
                      {technique.id} - {technique.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* MITRE Sub-technique */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  MITRE Sub-technique (Optional)
                </label>
                <select
                  name="mitre_subtechnique"
                  defaultValue={selectedNode.mitre_subtechnique || ''}
                  disabled={!selectedTechnique || availableSubtechniques.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    backgroundColor: (!selectedTechnique || availableSubtechniques.length === 0) ? '#F3F4F6' : '#fff'
                  }}
                >
                  <option value="">
                    {!selectedTechnique ? '-- Select Technique First --' : 
                     availableSubtechniques.length === 0 ? '-- No Sub-techniques --' : 
                     '-- Select Sub-technique --'}
                  </option>
                  {availableSubtechniques.map(sub => {
                    const subId = sub.split(' ')[0];
                    return (
                      <option key={subId} value={subId}>{sub}</option>
                    );
                  })}
                </select>
              </div>
              
              {/* Severity */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  Severity
                </label>
                <select
                  name="severity"
                  defaultValue={selectedNode.severity}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              {/* Notes */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  Notes
                </label>
                <textarea
                  name="notes"
                  defaultValue={selectedNode.notes || ''}
                  placeholder="Add analysis notes, evidence references, etc."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
              
              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowNodeEditor(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#F3F4F6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: '#2563EB',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Add Node Modal */}
      {showAddNode && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowAddNode(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-2xl)',
              padding: '32px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '24px' }}>
              Add Key Timestamp to Chain
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {availableTimestamps.filter(ts => 
                !nodes.some(n => n.key_timestamp_id === ts.id)
              ).map(timestamp => (
                <div
                  key={timestamp.id}
                  onClick={() => addNodeToChain(timestamp.id)}
                  style={{
                    padding: '16px',
                    border: '2px solid var(--gray-200)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${timestamp.color}`,
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--gray-50)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{timestamp.label}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                    {new Date(timestamp.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
