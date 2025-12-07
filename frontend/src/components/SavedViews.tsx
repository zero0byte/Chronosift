import { useState, useEffect } from 'react';
import { viewsAPI } from '../lib/api';

interface SavedView {
  id: number;
  timeline_id: number;
  name: string;
  description?: string;
  is_pinned: boolean;
  is_shared: boolean;
  filter_config?: any;
  sort_config?: any;
  visible_columns?: string[];
  column_widths?: Record<string, number>;
  created_at: string;
  created_by: number;
}

interface SavedViewsProps {
  timelineId: number;
  onLoadView: (view: SavedView) => void;
  currentState?: {
    filter?: any;
    sort?: any;
    visibleColumns?: string[];
    columnWidths?: Record<string, number>;
  };
}

export default function SavedViews({ timelineId, onLoadView, currentState }: SavedViewsProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDesc, setNewViewDesc] = useState('');
  const [newViewShared, setNewViewShared] = useState(false);

  useEffect(() => {
    loadViews();
  }, [timelineId]);

  const loadViews = async () => {
    try {
      setLoading(true);
      const response = await viewsAPI.listForTimeline(timelineId);
      // Handle both array and object with 'views' property
      const viewsData = Array.isArray(response.data) ? response.data : (response.data.views || []);
      setViews(viewsData);
    } catch (error) {
      console.error('Failed to load views:', error);
      setViews([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateView = async () => {
    if (!newViewName.trim()) {
      alert('View name is required');
      return;
    }

    try {
      await viewsAPI.create({
        timeline_id: timelineId,
        name: newViewName,
        description: newViewDesc || undefined,
        is_shared: newViewShared,
        filter_config: currentState?.filter,
        sort_config: currentState?.sort,
        visible_columns: currentState?.visibleColumns,
        column_widths: currentState?.columnWidths,
      });
      
      setNewViewName('');
      setNewViewDesc('');
      setNewViewShared(false);
      setShowCreateForm(false);
      await loadViews();
    } catch (error: any) {
      console.error('Failed to create view:', error);
      alert(`Failed to create view: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleTogglePin = async (viewId: number) => {
    try {
      await viewsAPI.togglePin(viewId);
      await loadViews();
    } catch (error) {
      console.error('Failed to toggle pin:', error);
    }
  };

  const handleDelete = async (viewId: number, viewName: string) => {
    if (!window.confirm(`Delete view "${viewName}"?`)) return;

    try {
      await viewsAPI.delete(viewId);
      await loadViews();
    } catch (error) {
      console.error('Failed to delete view:', error);
      alert('Failed to delete view');
    }
  };

  const pinnedViews = views.filter(v => v.is_pinned);
  const unpinnedViews = views.filter(v => !v.is_pinned);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', marginBottom: '16px', backgroundColor: '#f9f9f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>📌 Saved Views</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Save Current View'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ marginBottom: '12px', padding: '12px', backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
              View Name *
            </label>
            <input
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g., Suspicious Logins"
              style={{ width: '100%', padding: '6px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', fontWeight: 500 }}>
              Description
            </label>
            <input
              type="text"
              value={newViewDesc}
              onChange={(e) => setNewViewDesc(e.target.value)}
              placeholder="Optional description"
              style={{ width: '100%', padding: '6px', fontSize: '13px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={newViewShared}
                onChange={(e) => setNewViewShared(e.target.checked)}
                style={{ marginRight: '6px' }}
              />
              Share with team
            </label>
          </div>
          <button
            onClick={handleCreateView}
            style={{
              padding: '6px 16px',
              fontSize: '13px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Save View
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading views...</div>
      ) : views.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999', fontSize: '13px' }}>
          No saved views yet. Configure your filters and columns, then save a view!
        </div>
      ) : (
        <div>
          {pinnedViews.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              {pinnedViews.map(view => (
                <ViewItem
                  key={view.id}
                  view={view}
                  onLoad={() => onLoadView(view)}
                  onTogglePin={() => handleTogglePin(view.id)}
                  onDelete={() => handleDelete(view.id, view.name)}
                />
              ))}
            </div>
          )}
          
          {unpinnedViews.length > 0 && (
            <div>
              {unpinnedViews.map(view => (
                <ViewItem
                  key={view.id}
                  view={view}
                  onLoad={() => onLoadView(view)}
                  onTogglePin={() => handleTogglePin(view.id)}
                  onDelete={() => handleDelete(view.id, view.name)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ViewItem({ view, onLoad, onTogglePin, onDelete }: {
  view: SavedView;
  onLoad: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        marginBottom: '4px',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
      onClick={onLoad}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', fontWeight: 500 }}>
          {view.is_pinned && '📌 '}
          {view.name}
          {view.is_shared && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#666' }}>👥 Shared</span>}
        </div>
        {view.description && (
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{view.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onTogglePin}
          title={view.is_pinned ? 'Unpin' : 'Pin'}
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'transparent',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {view.is_pinned ? '📌' : '📍'}
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          style={{
            padding: '4px 8px',
            fontSize: '11px',
            backgroundColor: 'transparent',
            color: '#dc3545',
            border: '1px solid #ddd',
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
