import { useState, useEffect } from 'react';
import { activitiesAPI } from '../lib/api';
import { useWebSocket } from '../lib/WebSocketContext';

interface Activity {
  id: number;
  project_id: number;
  user_id: number;
  user: {
    id: number;
    full_name: string;
  };
  activity_type: string;
  entity_type: string;
  entity_id: number;
  metadata: any;
  created_at: string;
}

interface ActivityFeedProps {
  projectId: number;
}

export default function ActivityFeed({ projectId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const { socket } = useWebSocket();

  useEffect(() => {
    loadActivities();
  }, [projectId, page]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new activities
    socket.on('new_activity', (data: Activity) => {
      if (data.project_id === projectId) {
        setActivities(prev => [data, ...prev]);
      }
    });

    return () => {
      socket.off('new_activity');
    };
  }, [socket, projectId]);

  const loadActivities = async () => {
    try {
      setLoading(true);
      const response = await activitiesAPI.getProjectActivities(projectId, page, 20);
      const newActivities = response.data.activities || [];
      
      if (page === 1) {
        setActivities(newActivities);
      } else {
        setActivities(prev => [...prev, ...newActivities]);
      }
      
      setHasMore(newActivities.length === 20);
    } catch (error) {
      console.error('Failed to load activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'entry_created': return '📝';
      case 'entry_updated': return '✏️';
      case 'entry_deleted': return '🗑️';
      case 'comment_added': return '💬';
      case 'entry_promoted': return '⭐';
      case 'timeline_created': return '📊';
      default: return '📌';
    }
  };

  const getActivityMessage = (activity: Activity) => {
    const { activity_type, metadata, user } = activity;
    const userName = user.full_name;

    switch (activity_type) {
      case 'entry_created':
        return `${userName} created an entry in ${metadata.timeline_name}`;
      case 'entry_updated':
        return `${userName} updated an entry in ${metadata.timeline_name}`;
      case 'entry_deleted':
        return `${userName} deleted an entry from ${metadata.timeline_name}`;
      case 'comment_added':
        const preview = metadata.content_preview || '';
        return `${userName} commented: "${preview.substring(0, 60)}${preview.length > 60 ? '...' : ''}"`;
      case 'entry_promoted':
        return `${userName} promoted ${metadata.promoted_count} entries to Master Timeline`;
      case 'timeline_created':
        return `${userName} created timeline ${metadata.timeline_name}`;
      default:
        return `${userName} performed ${activity_type}`;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ 
      backgroundColor: '#fff', 
      border: '1px solid #dee2e6', 
      borderRadius: '8px', 
      padding: '20px',
      maxHeight: '600px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>
        Activity Feed
      </h3>

      {loading && activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
          <p style={{ margin: 0 }}>Loading activities...</p>
        </div>
      ) : activities.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>📊</div>
          <p style={{ margin: 0 }}>No activities yet. Start working on this project!</p>
        </div>
      ) : (
        <div>
          {activities.map((activity, index) => (
            <div 
              key={`${activity.id}-${index}`}
              style={{
                padding: '12px',
                borderBottom: index < activities.length - 1 ? '1px solid #e9ecef' : 'none',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ fontSize: '24px', flexShrink: 0 }}>
                {getActivityIcon(activity.activity_type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ 
                  margin: '0 0 4px 0', 
                  fontSize: '14px', 
                  color: '#212529',
                  wordWrap: 'break-word'
                }}>
                  {getActivityMessage(activity)}
                </p>
                <span style={{ fontSize: '12px', color: '#6c757d' }}>
                  {formatTimeAgo(activity.created_at)}
                </span>
              </div>
            </div>
          ))}
          
          {hasMore && (
            <div style={{ textAlign: 'center', padding: '15px' }}>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: loading ? '#6c757d' : '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
