import { useState, useEffect, useRef } from 'react';
import { commentsAPI, projectAPI } from '../lib/api';
import { useWebSocket } from '../lib/WebSocketContext';

interface User {
  id: number;
  full_name: string;
  first_name?: string;
  last_name?: string;
}

interface Comment {
  id: number;
  entry_id: number;
  user_id: number;
  user: User;
  content: string;
  parent_id: number | null;
  is_edited: boolean;
  mentions: any[];
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

interface CommentSectionProps {
  entryId: number;
  projectId: number;
}

export default function CommentSection({ entryId, projectId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editingComment, setEditingComment] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { socket } = useWebSocket();
  
  // Mention autocomplete state
  const [projectMembers, setProjectMembers] = useState<User[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUserId = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!).id : null;

  useEffect(() => {
    loadComments();
    loadProjectMembers();
  }, [entryId, projectId]);
  
  const loadProjectMembers = async () => {
    try {
      const response = await projectAPI.get(projectId);
      const members = response.data.project.members?.map((m: any) => m.user) || [];
      setProjectMembers(members);
    } catch (error) {
      console.error('Failed to load project members:', error);
    }
  };

  useEffect(() => {
    if (!socket) return;

    // Listen for real-time comment events
    socket.on('comment_added', (data: Comment) => {
      if (data.entry_id === entryId) {
        loadComments(); // Reload to get proper threading
      }
    });

    socket.on('comment_updated', (data: Comment) => {
      if (data.entry_id === entryId) {
        setComments(prev => updateCommentInTree(prev, data));
      }
    });

    socket.on('comment_deleted', (data: { comment_id: number }) => {
      setComments(prev => removeCommentFromTree(prev, data.comment_id));
    });

    return () => {
      socket.off('comment_added');
      socket.off('comment_updated');
      socket.off('comment_deleted');
    };
  }, [socket, entryId]);

  const loadComments = async () => {
    try {
      const response = await commentsAPI.getEntryComments(entryId);
      setComments(response.data.comments || []);
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const updateCommentInTree = (comments: Comment[], updatedComment: Comment): Comment[] => {
    return comments.map(comment => {
      if (comment.id === updatedComment.id) {
        return { ...comment, ...updatedComment };
      }
      if (comment.replies) {
        return { ...comment, replies: updateCommentInTree(comment.replies, updatedComment) };
      }
      return comment;
    });
  };

  const removeCommentFromTree = (comments: Comment[], commentId: number): Comment[] => {
    return comments.filter(comment => {
      if (comment.id === commentId) return false;
      if (comment.replies) {
        comment.replies = removeCommentFromTree(comment.replies, commentId);
      }
      return true;
    });
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      await commentsAPI.createComment(entryId, {
        content: newComment,
        parent_id: replyTo || undefined,
      });
      setNewComment('');
      setReplyTo(null);
      // Real-time update will handle adding the comment
    } catch (error: any) {
      console.error('Failed to create comment:', error);
      alert(`Failed to add comment: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateComment = async (commentId: number) => {
    if (!editContent.trim()) return;

    try {
      await commentsAPI.updateComment(commentId, { content: editContent });
      setEditingComment(null);
      setEditContent('');
      // Real-time update will handle the change
    } catch (error: any) {
      console.error('Failed to update comment:', error);
      alert(`Failed to update comment: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await commentsAPI.deleteComment(commentId);
      // Real-time update will handle removal
    } catch (error: any) {
      console.error('Failed to delete comment:', error);
      alert(`Failed to delete comment: ${error.response?.data?.error || error.message}`);
    }
  };

  const startEditing = (comment: Comment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };
  
  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNewComment(value);
    
    // Check for @ mention
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Check if there's a space after @, if so, don't show mentions
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
        setSelectedMentionIndex(0);
        
        // Calculate position for dropdown
        if (textareaRef.current) {
          const textarea = textareaRef.current;
          const rect = textarea.getBoundingClientRect();
          // Simple positioning - show dropdown below textarea
          setMentionPosition({
            top: rect.bottom,
            left: rect.left
          });
        }
        return;
      }
    }
    
    setShowMentions(false);
  };
  
  const handleMentionSelect = (user: User) => {
    if (!textareaRef.current) return;
    
    const cursorPosition = textareaRef.current.selectionStart;
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = newComment.substring(cursorPosition);
    
    // Build mention text
    const mentionText = user.full_name.includes(' ') ? `@"${user.full_name}"` : `@${user.full_name}`;
    
    // Replace from @ to cursor with mention
    const newText = newComment.substring(0, lastAtSymbol) + mentionText + ' ' + textAfterCursor;
    setNewComment(newText);
    setShowMentions(false);
    
    // Set cursor after mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newPosition = lastAtSymbol + mentionText.length + 1;
        textareaRef.current.selectionStart = newPosition;
        textareaRef.current.selectionEnd = newPosition;
        textareaRef.current.focus();
      }
    }, 0);
  };
  
  const handleMentionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions) return;
    
    const filteredMembers = projectMembers.filter(m => 
      m.full_name.toLowerCase().includes(mentionSearch)
    );
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => 
        prev < filteredMembers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => prev > 0 ? prev - 1 : 0);
    } else if (e.key === 'Enter' && filteredMembers.length > 0) {
      e.preventDefault();
      handleMentionSelect(filteredMembers[selectedMentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentions(false);
    }
  };
  
  const filteredMembers = showMentions ? projectMembers.filter(m => 
    m.full_name.toLowerCase().includes(mentionSearch)
  ) : [];

  const renderComment = (comment: Comment, isReply = false) => {
    const isEditing = editingComment === comment.id;
    const isOwner = comment.user_id === currentUserId;

    return (
      <div key={comment.id} style={{ marginLeft: isReply ? '40px' : '0', marginBottom: '15px' }}>
        <div style={{ 
          padding: '12px', 
          backgroundColor: isReply ? '#f8f9fa' : '#fff', 
          border: '1px solid #dee2e6', 
          borderRadius: '6px' 
        }}>
          {/* Comment Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <strong style={{ fontSize: '14px', color: '#495057' }}>{comment.user.full_name}</strong>
              <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>
                {new Date(comment.created_at).toLocaleString()}
                {comment.is_edited && <span style={{ fontStyle: 'italic', marginLeft: '4px' }}>(edited)</span>}
              </span>
            </div>
            {isOwner && !isEditing && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => startEditing(comment)}
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
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '12px', 
                    backgroundColor: '#dc3545', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '3px', 
                    cursor: 'pointer' 
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Comment Content */}
          {isEditing ? (
            <div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{ 
                  width: '100%', 
                  minHeight: '60px', 
                  padding: '8px', 
                  border: '1px solid #ced4da', 
                  borderRadius: '4px', 
                  fontSize: '14px',
                  resize: 'vertical'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleUpdateComment(comment.id)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '13px', 
                    backgroundColor: '#28a745', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditingComment(null); setEditContent(''); }}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '13px', 
                    backgroundColor: '#6c757d', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '14px', color: '#212529', margin: '0 0 8px 0', whiteSpace: 'pre-wrap' }}>
                {comment.content}
              </p>
              {!isReply && (
                <button
                  onClick={() => setReplyTo(comment.id)}
                  style={{ 
                    padding: '4px 8px', 
                    fontSize: '12px', 
                    backgroundColor: 'transparent', 
                    color: '#007bff', 
                    border: 'none', 
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Reply
                </button>
              )}
            </div>
          )}
        </div>

        {/* Render Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #dee2e6' }}>
      <h4 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>
        Comments ({comments.length})
      </h4>

      {/* Comment Form */}
      <form onSubmit={handleSubmitComment} style={{ marginBottom: '20px' }}>
        {replyTo && (
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: '#e7f3ff', 
            border: '1px solid #b3d9ff', 
            borderRadius: '4px', 
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', color: '#004085' }}>Replying to comment...</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              style={{ 
                padding: '2px 8px', 
                fontSize: '12px', 
                backgroundColor: 'transparent', 
                color: '#004085', 
                border: 'none', 
                cursor: 'pointer' 
              }}
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={newComment}
            onChange={handleCommentChange}
            onKeyDown={handleMentionKeyDown}
            placeholder="Add a comment... Use @username to mention someone"
            style={{ 
              width: '100%', 
              minHeight: '80px', 
              padding: '10px', 
              border: '1px solid #ced4da', 
              borderRadius: '4px', 
              fontSize: '14px',
              resize: 'vertical'
            }}
          />
          
          {/* Mention Dropdown */}
          {showMentions && filteredMembers.length > 0 && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '4px',
              backgroundColor: '#fff',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 1000,
              minWidth: '250px'
            }}>
              {filteredMembers.map((member, index) => (
                <div
                  key={member.id}
                  onClick={() => handleMentionSelect(member)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: index === selectedMentionIndex ? '#e7f3ff' : '#fff',
                    fontSize: '14px',
                    borderBottom: index < filteredMembers.length - 1 ? '1px solid #f0f0f0' : 'none'
                  }}
                  onMouseEnter={() => setSelectedMentionIndex(index)}
                >
                  <strong>{member.full_name}</strong>
                  {member.first_name && member.last_name && (
                    <span style={{ fontSize: '12px', color: '#6c757d', marginLeft: '8px' }}>
                      @{member.full_name.includes(' ') ? `"${member.full_name}"` : member.full_name}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="submit"
            disabled={loading || !newComment.trim()}
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
            {loading ? 'Posting...' : replyTo ? 'Post Reply' : 'Post Comment'}
          </button>
          {replyTo && (
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              style={{ 
                padding: '8px 16px', 
                fontSize: '14px', 
                backgroundColor: '#6c757d', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer' 
              }}
            >
              Cancel Reply
            </button>
          )}
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d' }}>
          💡 Tip: Use @username or @"First Last" to mention team members
        </div>
      </form>

      {/* Comments List */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>💬</div>
          <p style={{ margin: 0 }}>No comments yet. Be the first to comment!</p>
        </div>
      ) : (
        <div>
          {comments.map(comment => renderComment(comment))}
        </div>
      )}
    </div>
  );
}
