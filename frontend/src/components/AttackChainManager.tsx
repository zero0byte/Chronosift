import { useState, useEffect } from 'react';
import { attackChainsAPI, keyTimestampsAPI } from '../lib/api';
import AttackChainBuilder from './AttackChainBuilder';

interface AttackChain {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
  node_count: number;
}

interface KeyTimestamp {
  id: number;
  timestamp: string;
  label: string;
  description?: string;
  color: string;
}

interface AttackChainManagerProps {
  projectId: number;
}

export default function AttackChainManager({ projectId }: AttackChainManagerProps) {
  const [chains, setChains] = useState<AttackChain[]>([]);
  const [timestamps, setTimestamps] = useState<KeyTimestamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [newChainName, setNewChainName] = useState('');
  const [newChainDesc, setNewChainDesc] = useState('');

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [chainsRes, timestampsRes] = await Promise.all([
        attackChainsAPI.list(projectId),
        keyTimestampsAPI.list(projectId)
      ]);
      
      setChains(chainsRes.data.attack_chains || []);
      setTimestamps(timestampsRes.data.key_timestamps || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChain = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newChainName.trim()) {
      alert('Chain name is required');
      return;
    }

    try {
      const response = await attackChainsAPI.create(projectId, {
        name: newChainName,
        description: newChainDesc
      });
      
      setShowCreateModal(false);
      setNewChainName('');
      setNewChainDesc('');
      await loadData();
      
      // Immediately open the new chain
      setSelectedChain(response.data.attack_chain.id);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create attack chain');
    }
  };

  const deleteChain = async (chainId: number, chainName: string) => {
    if (!window.confirm(`Delete attack chain "${chainName}"? This will remove all nodes and connections.`)) {
      return;
    }

    try {
      await attackChainsAPI.delete(chainId);
      await loadData();
    } catch (error) {
      alert('Failed to delete attack chain');
    }
  };

  if (selectedChain) {
    return (
      <AttackChainBuilder
        projectId={projectId}
        chainId={selectedChain}
        availableTimestamps={timestamps}
        onClose={() => {
          setSelectedChain(null);
          loadData();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Loading attack chains...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--gray-900)',
            margin: 0
          }}>
            🔗 Attack Chains
          </h2>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--gray-600)',
            margin: '4px 0 0 0'
          }}>
            Build visual narratives of attack progression with MITRE ATT&CK mapping
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '12px 24px',
            background: 'var(--accent-green)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-base)',
            boxShadow: 'var(--shadow-md)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
          }}
        >
          + Create Attack Chain
        </button>
      </div>

      {/* Info Banner */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #EBF4FF 0%, #E0E7FF 100%)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #BFDBFE',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
          <div style={{ fontSize: '1.5rem' }}>💡</div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: '#1E40AF' }}>
              Build Attack Narratives
            </div>
            <div style={{ fontSize: '0.875rem', color: '#1E40AF' }}>
              Link key timestamps together to document attack progression. Drag nodes to arrange, Shift+Click to connect, and export to MITRE ATT&CK Navigator.
            </div>
          </div>
        </div>
      </div>

      {/* Chains List */}
      {chains.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-xl)',
          border: '2px dashed var(--gray-300)'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🔗</div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: 'var(--gray-900)',
            marginBottom: '8px'
          }}>
            No Attack Chains Yet
          </h3>
          <p style={{
            color: 'var(--gray-600)',
            marginBottom: '24px',
            maxWidth: '500px',
            margin: '0 auto 24px'
          }}>
            Create your first attack chain to document the sequence of events in your investigation.
            Perfect for ransomware attacks, data breaches, and APT campaigns.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '14px 28px',
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-md)'
            }}
          >
            + Create First Chain
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {chains.map((chain) => (
            <div
              key={chain.id}
              style={{
                background: 'white',
                border: '2px solid var(--gray-200)',
                borderRadius: 'var(--radius-xl)',
                padding: '24px',
                transition: 'var(--transition-base)',
                cursor: 'pointer',
                position: 'relative'
              }}
              onClick={() => setSelectedChain(chain.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--gray-200)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Icon */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🔗</span>
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: 'var(--gray-900)',
                margin: '0 0 8px 0'
              }}>
                {chain.name}
              </h3>

              {/* Description */}
              {chain.description && (
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--gray-600)',
                  margin: '0 0 16px 0',
                  lineHeight: '1.5'
                }}>
                  {chain.description.substring(0, 100)}
                  {chain.description.length > 100 && '...'}
                </p>
              )}

              {/* Stats */}
              <div style={{
                display: 'flex',
                gap: '16px',
                marginBottom: '16px',
                paddingTop: '16px',
                borderTop: '1px solid var(--gray-200)'
              }}>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-blue)' }}>
                    {chain.node_count}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    Nodes
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--gray-700)' }}>
                    {chain.creator_name || 'Unknown'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                    Created by
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                  Updated {new Date(chain.updated_at).toLocaleDateString()}
                </div>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteChain(chain.id, chain.name);
                  }}
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'var(--error)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--error)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)';
                    e.currentTarget.style.color = 'var(--error)';
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowCreateModal(false);
            setNewChainName('');
            setNewChainDesc('');
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 'var(--radius-2xl)',
              padding: '32px',
              maxWidth: '600px',
              width: '90%',
              boxShadow: 'var(--shadow-xl)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              marginBottom: '8px'
            }}>
              🔗 Create Attack Chain
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--gray-600)',
              marginBottom: '24px'
            }}>
              Document the attack progression by linking key timestamps together
            </p>

            <form onSubmit={createChain}>
              {/* Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--gray-900)'
                }}>
                  Chain Name *
                </label>
                <input
                  type="text"
                  value={newChainName}
                  onChange={(e) => setNewChainName(e.target.value)}
                  required
                  placeholder="e.g., Ransomware Attack Timeline"
                  maxLength={200}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* Description */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: 'var(--gray-900)'
                }}>
                  Description
                </label>
                <textarea
                  value={newChainDesc}
                  onChange={(e) => setNewChainDesc(e.target.value)}
                  placeholder="Optional: Describe the attack scenario..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    border: '1px solid var(--gray-300)',
                    borderRadius: 'var(--radius-md)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewChainName('');
                    setNewChainDesc('');
                  }}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    color: 'var(--gray-700)',
                    border: '2px solid var(--gray-300)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '12px 24px',
                    background: 'var(--accent-green)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-md)'
                  }}
                >
                  🔗 Create Chain
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
