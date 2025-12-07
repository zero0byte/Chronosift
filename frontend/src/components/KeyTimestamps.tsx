import { useState, useEffect } from 'react';
import { keyTimestampsAPI } from '../lib/api';
import TimelineGraph from './TimelineGraph';

interface KeyTimestamp {
  id: number;
  project_id: number;
  timestamp: string;
  label: string;
  description?: string;
  color: string;
  created_by: number;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

interface KeyTimestampsProps {
  projectId: number;
  onSearch?: (timestampId: number) => void;
}

const PRESET_COLORS = [
  { name: 'Red', value: '#DC2626', label: 'Critical' },
  { name: 'Orange', value: '#F59E0B', label: 'Suspicious' },
  { name: 'Yellow', value: '#FCD34D', label: 'Warning' },
  { name: 'Green', value: '#10B981', label: 'Resolution' },
  { name: 'Blue', value: '#2563EB', label: 'Info' },
  { name: 'Purple', value: '#9333EA', label: 'Analysis' },
  { name: 'Pink', value: '#E94B8B', label: 'Important' },
];

export default function KeyTimestamps({ projectId, onSearch }: KeyTimestampsProps) {
  const [timestamps, setTimestamps] = useState<KeyTimestamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTimestamp, setEditingTimestamp] = useState<KeyTimestamp | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');
  
  // Form state
  const [formData, setFormData] = useState({
    timestamp: '',
    label: '',
    description: '',
    color: '#2563EB'
  });

  useEffect(() => {
    loadTimestamps();
  }, [projectId]);

  const loadTimestamps = async () => {
    try {
      setLoading(true);
      const response = await keyTimestampsAPI.list(projectId);
      setTimestamps(response.data.key_timestamps);
    } catch (error) {
      console.error('Failed to load key timestamps:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTimestamp) {
        await keyTimestampsAPI.update(editingTimestamp.id, formData);
      } else {
        await keyTimestampsAPI.create(projectId, formData);
      }
      loadTimestamps();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save key timestamp');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this key timestamp?')) return;
    try {
      await keyTimestampsAPI.delete(id);
      loadTimestamps();
    } catch (error) {
      alert('Failed to delete key timestamp');
    }
  };

  const handleEdit = (timestamp: KeyTimestamp) => {
    setEditingTimestamp(timestamp);
    setFormData({
      timestamp: timestamp.timestamp.substring(0, 16),
      label: timestamp.label,
      description: timestamp.description || '',
      color: timestamp.color
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setShowAddModal(false);
    setEditingTimestamp(null);
    setFormData({
      timestamp: '',
      label: '',
      description: '',
      color: '#2563EB'
    });
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString();
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading key timestamps...</div>;
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
            🔖 Key Timestamps
          </h2>
          <p style={{ 
            fontSize: '0.9375rem', 
            color: 'var(--gray-600)', 
            margin: '4px 0 0 0' 
          }}>
            Mark important moments and search across all timelines
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* View Toggle */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--gray-100)', 
            borderRadius: 'var(--radius-lg)',
            padding: '4px'
          }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'list' ? 'white' : 'transparent',
                color: viewMode === 'list' ? 'var(--gray-900)' : 'var(--gray-600)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('graph')}
              style={{
                padding: '8px 16px',
                background: viewMode === 'graph' ? 'white' : 'transparent',
                color: viewMode === 'graph' ? 'var(--gray-900)' : 'var(--gray-600)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                boxShadow: viewMode === 'graph' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              📊 Graph
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--accent-pink)',
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
            + Add Key Timestamp
          </button>
        </div>
      </div>

      {/* Graph View */}
      {viewMode === 'graph' ? (
        <TimelineGraph
          keyTimestamps={timestamps}
          onTimestampClick={(timestamp) => onSearch?.(timestamp.id)}
          height={500}
        />
      ) : (
        /* List View */
        <>
      {timestamps.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-xl)',
          border: '2px dashed var(--gray-300)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔖</div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '8px' }}>
            No Key Timestamps Yet
          </h3>
          <p style={{ color: 'var(--gray-600)', marginBottom: '24px' }}>
            Mark important moments in your investigation to search across all timelines
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '12px 24px',
              background: 'var(--accent-blue)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Create First Timestamp
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {timestamps.map((ts) => (
            <div
              key={ts.id}
              style={{
                background: 'white',
                border: '2px solid var(--gray-200)',
                borderRadius: 'var(--radius-xl)',
                padding: '20px',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                transition: 'var(--transition-base)',
                borderLeft: `4px solid ${ts.color}`
              }}
            >
              {/* Color indicator */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: ts.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 700,
                flexShrink: 0
              }}>
                🔖
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ 
                      fontSize: '1.125rem', 
                      fontWeight: 700, 
                      color: 'var(--gray-900)', 
                      margin: '0 0 4px 0' 
                    }}>
                      {ts.label}
                    </h3>
                    <div style={{ 
                      fontSize: '0.875rem', 
                      color: 'var(--gray-600)', 
                      marginBottom: '8px' 
                    }}>
                      ⏰ {formatTimestamp(ts.timestamp)}
                    </div>
                    {ts.description && (
                      <p style={{ 
                        fontSize: '0.9375rem', 
                        color: 'var(--gray-700)', 
                        margin: '8px 0 0 0' 
                      }}>
                        {ts.description}
                      </p>
                    )}
                    {ts.creator_name && (
                      <div style={{ 
                        fontSize: '0.8125rem', 
                        color: 'var(--gray-500)', 
                        marginTop: '8px' 
                      }}>
                        Created by {ts.creator_name}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {onSearch && (
                  <button
                    onClick={() => onSearch(ts.id)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--accent-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                    title="Search for entries around this timestamp"
                  >
                    🔍 Search
                  </button>
                )}
                <button
                  onClick={() => handleEdit(ts)}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--gray-100)',
                    color: 'var(--gray-700)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(ts.id)}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(220, 38, 38, 0.1)',
                    color: 'var(--error)',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div style={{
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
        }} onClick={resetForm}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-2xl)',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: 'var(--shadow-xl)'
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700, 
              marginBottom: '24px' 
            }}>
              {editingTimestamp ? 'Edit Key Timestamp' : 'Add Key Timestamp'}
            </h3>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '0.9375rem', 
                  fontWeight: 600,
                  color: 'var(--gray-900)'
                }}>
                  Timestamp *
                </label>
                <input
                  type="datetime-local"
                  value={formData.timestamp}
                  onChange={(e) => setFormData({ ...formData, timestamp: e.target.value })}
                  required
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '8px', 
                  fontSize: '0.9375rem', 
                  fontWeight: 600,
                  color: 'var(--gray-900)'
                }}>
                  Label *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  required
                  placeholder="e.g., Initial Compromise"
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

              <div style={{ marginBottom: '20px' }}>
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
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional details..."
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

              <div style={{ marginBottom: '24px' }}>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '12px', 
                  fontSize: '0.9375rem', 
                  fontWeight: 600,
                  color: 'var(--gray-900)'
                }}>
                  Color
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: 'var(--radius-md)',
                        background: color.value,
                        border: formData.color === color.value ? '3px solid var(--gray-900)' : '2px solid var(--gray-300)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                        transform: formData.color === color.value ? 'scale(1.1)' : 'scale(1)'
                      }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
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
                  {editingTimestamp ? 'Update' : 'Create'} Timestamp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
