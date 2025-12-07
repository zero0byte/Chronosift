import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { commentsAPI } from '../lib/api';
import { useWebSocket } from '../lib/WebSocketContext';

interface Mention {
  id: number;
  comment_id: number;
  mentioned_user_id: number;
  is_read: boolean;
  created_at: string;
  comment: {
    id: number;
    content: string;
    entry_id: number;
    timeline_id: number;
    user: {
      full_name: string;
    };
  };
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { socket } = useWebSocket();

  useEffect(() => {
    loadMentions();
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for new mentions
    socket.on('new_mention', (data: Mention) => {
      setMentions(prev => [data, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('new_mention');
    };
  }, [socket]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const loadMentions = async () => {
    try {
      setLoading(true);
      const response = await commentsAPI.getMentions(false, 1, 20);
      const allMentions = response.data.mentions || [];
      setMentions(allMentions);
      setUnreadCount(allMentions.filter((m: Mention) => !m.is_read).length);
    } catch (error) {
      console.error('Failed to load mentions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (mentionId: number) => {
    try {
      await commentsAPI.markMentionRead(mentionId);
      setMentions(prev => 
        prev.map(m => m.id === mentionId ? { ...m, is_read: true } : m)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark mention as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await commentsAPI.markAllMentionsRead();
      setMentions(prev => prev.map(m => ({ ...m, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all mentions as read:', error);
    }
  };

  const handleMentionClick = async (mention: Mention) => {
    try {
      // Mark as read
      if (!mention.is_read) {
        await handleMarkAsRead(mention.id);
      }

      // Close dropdown
      setShowDropdown(false);
      
      // Navigate to timeline and pass entry ID via state to open comments
      navigate(`/timelines/${mention.comment.timeline_id}`, { 
        state: { selectedEntryId: mention.comment.entry_id } 
      });
    } catch (error) {
      console.error('Failed to navigate to comment:', error);
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
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px'
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: '#dc3545',
            color: '#fff',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 'bold'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: '400px',
          maxHeight: '500px',
          backgroundColor: '#fff',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          overflow: 'hidden'
        }}>
          {/* Header */}
          <div style={{
            padding: '15px',
            borderBottom: '1px solid #e9ecef',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Notifications
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  backgroundColor: '#007bff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Mentions List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
                <p style={{ margin: 0 }}>Loading notifications...</p>
              </div>
            ) : mentions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔕</div>
                <p style={{ margin: 0 }}>No notifications yet</p>
              </div>
            ) : (
              mentions.map((mention: any) => (
                <div
                  key={mention.id}
                  onClick={() => handleMentionClick(mention)}
                  style={{
                    padding: '12px 15px',
                    borderBottom: '1px solid #e9ecef',
                    backgroundColor: mention.is_read ? '#fff' : '#e7f3ff',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '13px', color: '#495057' }}>
                      {mention.comment?.user?.full_name || 'Unknown User'}
                    </strong>
                    {!mention.is_read && (
                      <span style={{
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#007bff',
                        borderRadius: '50%',
                        display: 'inline-block',
                        flexShrink: 0,
                        marginLeft: '8px'
                      }} />
                    )}
                  </div>
                  <p style={{
                    fontSize: '13px',
                    color: '#212529',
                    margin: '0 0 4px 0',
                    wordWrap: 'break-word',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>
                    {mention.comment?.content || 'mentioned you in a comment'}
                  </p>
                  <span style={{ fontSize: '11px', color: '#6c757d' }}>
                    {formatTimeAgo(mention.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
