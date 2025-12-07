import { useState, useEffect } from 'react';
import { savedQueriesAPI } from '../lib/api';

interface SavedQuery {
  id: number;
  timeline_id: number;
  name: string;
  description?: string;
  query_config: any;
  is_pinned: boolean;
  is_shared: boolean;
  created_at: string;
  created_by: number;
  creator_name?: string;
}

interface SavedQueriesProps {
  timelineId: number;
  onLoadQuery: (query: SavedQuery) => void;
  onSaveNew?: (queryConfig: any) => void;
  pendingQueryConfig?: any;
}

export default function SavedQueries({ timelineId, onLoadQuery, onSaveNew, pendingQueryConfig }: SavedQueriesProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newQueryName, setNewQueryName] = useState('');
  const [newQueryDesc, setNewQueryDesc] = useState('');
  const [newQueryShared, setNewQueryShared] = useState(false);

  useEffect(() => {
    loadQueries();
  }, [timelineId]);

  // Auto-open form when pendingQueryConfig is provided
  useEffect(() => {
    if (pendingQueryConfig) {
      setShowCreateForm(true);
    }
  }, [pendingQueryConfig]);

  const loadQueries = async () => {
    try {
      setLoading(true);
      const response = await savedQueriesAPI.listForTimeline(timelineId);
      const queriesData = Array.isArray(response.data) ? response.data : (response.data.queries || []);
      setQueries(queriesData);
    } catch (error) {
      console.error('Failed to load saved queries:', error);
      setQueries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuery = async () => {
    if (!newQueryName.trim()) {
      alert('Query name is required');
      return;
    }

    if (!pendingQueryConfig && onSaveNew) {
      alert('No query configuration to save. Apply some filters first.');
      return;
    }

    try {
      await savedQueriesAPI.create(timelineId, {
        name: newQueryName,
        description: newQueryDesc || undefined,
        query_config: pendingQueryConfig || {},
        is_shared: newQueryShared,
        is_pinned: false,
      });
      
      setNewQueryName('');
      setNewQueryDesc('');
      setNewQueryShared(false);
      setShowCreateForm(false);
      await loadQueries();
    } catch (error: any) {
      console.error('Failed to create query:', error);
      alert(`Failed to create query: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleTogglePin = async (queryId: number, currentPinned: boolean) => {
    try {
      await savedQueriesAPI.togglePin(queryId, !currentPinned);
      await loadQueries();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleDelete = async (queryId: number, queryName: string) => {
    if (!window.confirm(`Delete query "${queryName}"?`)) return;

    try {
      await savedQueriesAPI.delete(queryId);
      await loadQueries();
    } catch (error) {
      console.error('Failed to delete query:', error);
      alert('Failed to delete query');
    }
  };

  const pinnedQueries = queries.filter(q => q.is_pinned);
  const unpinnedQueries = queries.filter(q => !q.is_pinned);

  return (
    <div style={{ border: '1px solid #374151', borderRadius: '8px', padding: '16px', marginBottom: '16px', backgroundColor: '#1f2937' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f3f4f6' }}>💾 Saved Queries</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '6px 14px',
            fontSize: '13px',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Save Current Query'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '6px' }}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500, color: '#f3f4f6' }}>
              Query Name *
            </label>
            <input
              type="text"
              value={newQueryName}
              onChange={(e) => setNewQueryName(e.target.value)}
              placeholder="e.g., High Confidence Threats"
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #374151', borderRadius: '6px', backgroundColor: '#1f2937', color: '#fff' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', fontWeight: 500, color: '#f3f4f6' }}>
              Description
            </label>
            <input
              type="text"
              value={newQueryDesc}
              onChange={(e) => setNewQueryDesc(e.target.value)}
              placeholder="Optional description"
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #374151', borderRadius: '6px', backgroundColor: '#1f2937', color: '#fff' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '13px', cursor: 'pointer', color: '#f3f4f6' }}>
              <input
                type="checkbox"
                checked={newQueryShared}
                onChange={(e) => setNewQueryShared(e.target.checked)}
                style={{ marginRight: '8px', width: '16px', height: '16px' }}
              />
              Share with team
            </label>
          </div>
          <button
            onClick={handleCreateQuery}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Save Query
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#9ca3af' }}>Loading queries...</div>
      ) : queries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
          No saved queries yet. Create advanced filters and save them for quick access!
        </div>
      ) : (
        <div>
          {pinnedQueries.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              {pinnedQueries.map(query => (
                <QueryItem
                  key={query.id}
                  query={query}
                  onLoad={() => onLoadQuery(query)}
                  onTogglePin={() => handleTogglePin(query.id, query.is_pinned)}
                  onDelete={() => handleDelete(query.id, query.name)}
                />
              ))}
            </div>
          )}
          
          {unpinnedQueries.length > 0 && (
            <div>
              {unpinnedQueries.map(query => (
                <QueryItem
                  key={query.id}
                  query={query}
                  onLoad={() => onLoadQuery(query)}
                  onTogglePin={() => handleTogglePin(query.id, query.is_pinned)}
                  onDelete={() => handleDelete(query.id, query.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueryItem({ query, onLoad, onTogglePin, onDelete }: {
  query: SavedQuery;
  onLoad: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const filterCount = (query.query_config.field_filters?.length || 0) + 
                     (query.query_config.search_text ? 1 : 0) + 
                     (query.query_config.enrichment_filters?.has_enrichment ? 1 : 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px',
        marginBottom: '6px',
        backgroundColor: '#111827',
        border: '1px solid #374151',
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onClick={onLoad}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1f2937'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#111827'}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: '#f3f4f6' }}>
          {query.is_pinned && '📌 '}
          {query.name}
          {query.is_shared && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#9ca3af' }}>👥 Shared</span>}
        </div>
        {query.description && (
          <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{query.description}</div>
        )}
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
          {filterCount} filter{filterCount !== 1 ? 's' : ''} • {query.query_config.logic || 'AND'} logic
          {query.creator_name && ` • by ${query.creator_name}`}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onTogglePin}
          title={query.is_pinned ? 'Unpin' : 'Pin'}
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            backgroundColor: 'transparent',
            border: '1px solid #374151',
            borderRadius: '4px',
            cursor: 'pointer',
            color: '#f3f4f6',
          }}
        >
          {query.is_pinned ? '📌' : '📍'}
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            backgroundColor: 'transparent',
            color: '#ef4444',
            border: '1px solid #374151',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
