import { useState, useEffect } from 'react';
import { entryLinksAPI, projectAPI, timelineAPI } from '../lib/api';

interface TimelineEntry {
  id: number;
  timeline_id: number;
  timeline_name: string;
  data: any;
}

interface EntryLink {
  id: number;
  from_entry_id: number;
  to_entry_id: number;
  link_type: string;
  description?: string;
  created_at: string;
  from_entry?: TimelineEntry;
  to_entry?: TimelineEntry;
  creator?: {
    id: number;
    full_name: string;
    email: string;
  };
}

interface EntryLinksProps {
  entryId: number;
  projectId: number;
  currentTimelineId: number;
  onClose: () => void;
}

const LINK_TYPES = [
  { value: 'relates_to', label: 'Relates To', emoji: '🔗', color: '#6B7280' },
  { value: 'caused_by', label: 'Caused By', emoji: '⬅️', color: '#DC2626' },
  { value: 'leads_to', label: 'Leads To', emoji: '➡️', color: '#10B981' },
  { value: 'contradicts', label: 'Contradicts', emoji: '❌', color: '#F59E0B' },
  { value: 'supports', label: 'Supports', emoji: '✅', color: '#3B82F6' },
  { value: 'precedes', label: 'Precedes', emoji: '⏮️', color: '#8B5CF6' },
  { value: 'follows', label: 'Follows', emoji: '⏭️', color: '#EC4899' },
];

export default function EntryLinks({ entryId, projectId, currentTimelineId, onClose }: EntryLinksProps) {
  const [outgoingLinks, setOutgoingLinks] = useState<EntryLink[]>([]);
  const [incomingLinks, setIncomingLinks] = useState<EntryLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateLink, setShowCreateLink] = useState(false);
  
  // Create link form state
  const [inputMode, setInputMode] = useState<'search' | 'manual'>('search');
  const [projectTimelines, setProjectTimelines] = useState<any[]>([]);
  const [selectedTimeline, setSelectedTimeline] = useState<number | null>(null);
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<number>>(new Set());
  const [selectedLinkType, setSelectedLinkType] = useState('relates_to');
  const [linkDescription, setLinkDescription] = useState('');
  const [previewEntry, setPreviewEntry] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    loadLinks();
    loadProjectTimelines();
  }, [entryId]);

  const loadLinks = async () => {
    try {
      const response = await entryLinksAPI.listForEntry(entryId);
      setOutgoingLinks(response.data.outgoing_links || []);
      setIncomingLinks(response.data.incoming_links || []);
    } catch (error) {
      console.error('Failed to load links:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectTimelines = async () => {
    try {
      const response = await projectAPI.listTimelines(projectId);
      setProjectTimelines(response.data.timelines || []);
    } catch (error) {
      console.error('Failed to load timelines:', error);
    }
  };

  const loadTimelineEntries = async (timelineId: number, query: string = '') => {
    setLoadingEntries(true);
    try {
      if (query.trim()) {
        // Search entries
        const response = await timelineAPI.search(timelineId, query, 1, 50);
        setSearchResults(response.data.entries || []);
      } else {
        // List recent entries
        const response = await timelineAPI.listEntries(timelineId, 1, 50);
        setSearchResults(response.data.entries || []);
      }
    } catch (error) {
      console.error('Failed to load entries:', error);
      setSearchResults([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleTimelineChange = (timelineId: number) => {
    setSelectedTimeline(timelineId);
    setSelectedEntries(new Set());
    setSearchQuery('');
    setSearchResults([]);
    if (timelineId) {
      loadTimelineEntries(timelineId);
    }
  };

  const toggleEntrySelection = (entryId: number) => {
    setSelectedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEntries.size === searchResults.length && searchResults.length > 0) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(searchResults.map(e => e.id)));
    }
  };

  const handleSearchEntries = () => {
    if (selectedTimeline) {
      loadTimelineEntries(selectedTimeline, searchQuery);
    }
  };

  const loadPreviewData = async (entry: any) => {
    setLoadingPreview(true);
    try {
      // Fetch full entry details with timeline info
      const response = await timelineAPI.getEntry(entry.timeline_id, entry.id);
      const fullEntry = response.data.entry || response.data;
      
      // Get timeline info for display
      const timelineResponse = await timelineAPI.get(entry.timeline_id);
      setPreviewEntry({
        ...fullEntry,
        timeline: timelineResponse.data
      });
    } catch (error) {
      console.error('Failed to load preview:', error);
      // Show basic data even if full load fails
      setPreviewEntry(entry);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedEntries.size === 0) {
      alert('Please select at least one target entry');
      return;
    }

    try {
      const response = await entryLinksAPI.createBulk({
        from_entry_id: entryId,
        to_entry_ids: Array.from(selectedEntries),
        link_type: selectedLinkType,
        description: linkDescription || undefined,
      });
      
      // Show results
      const { created, failed, errors } = response.data;
      let message = `Successfully created ${created} link(s)`;
      if (failed > 0) {
        message += `\n${failed} failed:`;
        errors.forEach((err: any) => {
          message += `\n- Entry #${err.to_entry_id}: ${err.error}`;
        });
      }
      alert(message);
      
      setShowCreateLink(false);
      setInputMode('search');
      setSelectedTimeline(null);
      setSelectedEntries(new Set());
      setSearchQuery('');
      setSearchResults([]);
      setLinkDescription('');
      loadLinks();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create links');
    }
  };

  const handleDeleteLink = async (linkId: number) => {
    if (!window.confirm('Delete this link?')) return;
    
    try {
      await entryLinksAPI.delete(linkId);
      loadLinks();
    } catch (error) {
      alert('Failed to delete link');
    }
  };

  const getLinkTypeInfo = (type: string) => {
    return LINK_TYPES.find(t => t.value === type) || LINK_TYPES[0];
  };

  const formatEntryPreview = (entry: TimelineEntry) => {
    // Try to find a meaningful text field to display
    const data = entry.data;
    const preview = data.Description || data.description || data.Event || data.event || 
                   data.Message || data.message || data.Action || data.action || 
                   Object.values(data).find(v => typeof v === 'string' && v.length > 0) || 
                   'Entry #' + entry.id;
    return typeof preview === 'string' ? preview.substring(0, 60) : String(preview).substring(0, 60);
  };

  if (loading) {
    return (
      <div style={{
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
      }}>
        <div style={{ padding: '40px', background: '#fff', borderRadius: '8px' }}>
          Loading links...
        </div>
      </div>
    );
  }

  return (
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
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          maxWidth: '900px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          padding: '32px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Entry Links</h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowCreateLink(!showCreateLink)}
              style={{
                padding: '8px 16px',
                background: '#10B981',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              {showCreateLink ? '✕ Cancel' : '+ Add Link'}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: '#F3F4F6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div style={{
          padding: '12px 16px',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '6px',
          marginBottom: '24px',
          fontSize: '0.875rem',
          color: '#1E40AF'
        }}>
          💡 Link this entry to related events across timelines to capture investigator insights
        </div>

        {/* Create Link Form */}
        {showCreateLink && (
          <form onSubmit={handleCreateLink} style={{
            padding: '20px',
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            marginBottom: '24px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '1.125rem' }}>Create New Link</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Link Type */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  Relationship Type
                </label>
                <select
                  value={selectedLinkType}
                  onChange={(e) => setSelectedLinkType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                >
                  {LINK_TYPES.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.emoji} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Input Mode Toggle */}
              <div style={{ display: 'flex', gap: '8px', padding: '8px', background: '#F3F4F6', borderRadius: '6px' }}>
                <button
                  type="button"
                  onClick={() => setInputMode('search')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: inputMode === 'search' ? '#fff' : 'transparent',
                    color: inputMode === 'search' ? '#10B981' : '#6B7280',
                    border: inputMode === 'search' ? '1px solid #10B981' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  🔍 Search & Select
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('manual')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: inputMode === 'manual' ? '#fff' : 'transparent',
                    color: inputMode === 'manual' ? '#10B981' : '#6B7280',
                    border: inputMode === 'manual' ? '1px solid #10B981' : '1px solid transparent',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    transition: 'all 0.2s'
                  }}
                >
                  🔢 Enter ID Manually
                </button>
              </div>

              {/* Search Mode */}
              {inputMode === 'search' && (
                <>
                  {/* Timeline Selector */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                      Select Timeline
                    </label>
                    <select
                      value={selectedTimeline || ''}
                      onChange={(e) => handleTimelineChange(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        fontSize: '0.875rem'
                      }}
                    >
                      <option value="">Choose a timeline...</option>
                      {projectTimelines.map((timeline) => (
                        <option key={timeline.id} value={timeline.id}>
                          {timeline.name} ({timeline.entry_count || 0} entries)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Bar */}
                  {selectedTimeline && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                        Search Entries
                      </label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearchEntries()}
                          placeholder="Search by any field..."
                          style={{
                            flex: 1,
                            padding: '10px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '6px',
                            fontSize: '0.875rem'
                          }}
                        />
                        <button
                          type="button"
                          onClick={handleSearchEntries}
                          style={{
                            padding: '10px 20px',
                            background: '#10B981',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: 600
                          }}
                        >
                          Search
                        </button>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                        Leave empty to show recent entries
                      </p>
                    </div>
                  )}

                  {/* Entry Selection List */}
                  {selectedTimeline && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.875rem', margin: 0 }}>
                          Select Entries {selectedEntries.size > 0 && <span style={{ color: '#10B981' }}>✓ {selectedEntries.size} selected</span>}
                        </label>
                        {searchResults.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleSelectAll}
                            style={{
                              padding: '4px 12px',
                              fontSize: '0.75rem',
                              background: '#F3F4F6',
                              color: '#374151',
                              border: '1px solid #D1D5DB',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {selectedEntries.size === searchResults.length ? '☐ Deselect All' : '☑ Select All'}
                          </button>
                        )}
                      </div>
                      <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        border: '1px solid #D1D5DB',
                        borderRadius: '6px',
                        background: '#fff'
                      }}>
                        {loadingEntries ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                            Loading entries...
                          </div>
                        ) : searchResults.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}>
                            {searchQuery ? 'No entries found. Try a different search.' : 'No entries found in this timeline.'}
                          </div>
                        ) : (
                          searchResults.map((entry) => {
                            const preview = formatEntryPreview({ id: entry.id, timeline_id: entry.timeline_id, timeline_name: '', data: entry.data });
                            const isSelected = selectedEntries.has(entry.id);
                            return (
                              <div
                                key={entry.id}
                                style={{
                                  padding: '12px 16px',
                                  borderBottom: '1px solid #E5E7EB',
                                  cursor: 'pointer',
                                  background: isSelected ? '#D1FAE5' : '#fff',
                                  transition: 'background 0.2s',
                                  position: 'relative'
                                }}
                                onMouseEnter={(e) => !isSelected && (e.currentTarget.style.background = '#F9FAFB')}
                                onMouseLeave={(e) => !isSelected && (e.currentTarget.style.background = '#fff')}
                              >
                                <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                                  <div
                                    onClick={() => toggleEntrySelection(entry.id)}
                                    style={{
                                      minWidth: '20px',
                                      height: '20px',
                                      borderRadius: '4px',
                                      border: `2px solid ${isSelected ? '#10B981' : '#D1D5DB'}`,
                                      background: isSelected ? '#10B981' : '#fff',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      marginTop: '2px',
                                      flexShrink: 0
                                    }}
                                  >
                                    {isSelected && <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>✓</span>}
                                  </div>
                                  <div 
                                    style={{ flex: 1, minWidth: 0 }}
                                    onClick={() => toggleEntrySelection(entry.id)}
                                  >
                                    <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: '4px' }}>
                                      Entry #{entry.id}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {preview}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      loadPreviewData(entry);
                                    }}
                                    style={{
                                      padding: '4px 12px',
                                      fontSize: '0.75rem',
                                      background: '#EFF6FF',
                                      color: '#1E40AF',
                                      border: '1px solid #BFDBFE',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      flexShrink: 0,
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="View full details"
                                  >
                                    👁️ Preview
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Manual Mode */}
              {inputMode === 'manual' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                    Target Entry IDs (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={Array.from(selectedEntries).join(', ')}
                    onChange={(e) => {
                      const ids = e.target.value.split(',').map(s => s.trim()).filter(s => s).map(Number).filter(n => !isNaN(n));
                      setSelectedEntries(new Set(ids));
                    }}
                    placeholder="Enter entry IDs separated by commas (e.g., 123, 456, 789)"
                    required
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #D1D5DB',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}
                  />
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: '#6B7280' }}>
                    💡 Tip: Enter multiple IDs separated by commas. Open the other timeline and <strong>click on entry IDs</strong> to copy them.
                  </p>
                  {selectedEntries.size > 0 && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#D1FAE5', borderRadius: '4px', fontSize: '0.875rem', color: '#065F46' }}>
                      ✓ {selectedEntries.size} entry ID(s) entered: {Array.from(selectedEntries).join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.875rem' }}>
                  Description (Optional)
                </label>
                <textarea
                  value={linkDescription}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Why are these entries related?"
                  rows={3}
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

              <button
                type="submit"
                style={{
                  padding: '10px 20px',
                  background: '#10B981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Create Link
              </button>
            </div>
          </form>
        )}

        {/* Outgoing Links */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ➡️ Links From This Entry ({outgoingLinks.length})
          </h3>
          {outgoingLinks.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>No outgoing links</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {outgoingLinks.map(link => {
                const typeInfo = getLinkTypeInfo(link.link_type);
                return (
                  <div
                    key={link.id}
                    style={{
                      padding: '16px',
                      border: '1px solid #E5E7EB',
                      borderLeft: `4px solid ${typeInfo.color}`,
                      borderRadius: '6px',
                      background: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: typeInfo.color }}>
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                        {link.to_entry && (
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '4px' }}>
                            Timeline: <strong>{link.to_entry.timeline_name}</strong> • Entry #{link.to_entry.id}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        style={{
                          padding: '4px 8px',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    {link.to_entry && (
                      <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '8px' }}>
                        {formatEntryPreview(link.to_entry)}
                      </div>
                    )}
                    {link.description && (
                      <div style={{ fontSize: '0.875rem', color: '#6B7280', fontStyle: 'italic' }}>
                        "{link.description}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incoming Links */}
        <div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⬅️ Links To This Entry ({incomingLinks.length})
          </h3>
          {incomingLinks.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: '0.875rem' }}>No incoming links</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {incomingLinks.map(link => {
                const typeInfo = getLinkTypeInfo(link.link_type);
                return (
                  <div
                    key={link.id}
                    style={{
                      padding: '16px',
                      border: '1px solid #E5E7EB',
                      borderLeft: `4px solid ${typeInfo.color}`,
                      borderRadius: '6px',
                      background: '#fff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: typeInfo.color }}>
                          {typeInfo.emoji} {typeInfo.label}
                        </span>
                        {link.from_entry && (
                          <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '4px' }}>
                            Timeline: <strong>{link.from_entry.timeline_name}</strong> • Entry #{link.from_entry.id}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        style={{
                          padding: '4px 8px',
                          background: '#FEE2E2',
                          color: '#DC2626',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                    {link.from_entry && (
                      <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '8px' }}>
                        {formatEntryPreview(link.from_entry)}
                      </div>
                    )}
                    {link.description && (
                      <div style={{ fontSize: '0.875rem', color: '#6B7280', fontStyle: 'italic' }}>
                        "{link.description}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Entry Preview Modal */}
      {previewEntry && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001,
            padding: '20px'
          }}
          onClick={() => setPreviewEntry(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Preview Header */}
            <div style={{
              padding: '20px',
              borderBottom: '2px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#F9FAFB'
            }}>
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                  Entry #{previewEntry.id} Preview
                </h3>
                {previewEntry.timeline && (
                  <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>
                    Timeline: <strong>{previewEntry.timeline.name}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    toggleEntrySelection(previewEntry.id);
                    setPreviewEntry(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedEntries.has(previewEntry.id) ? '#DC2626' : '#10B981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  {selectedEntries.has(previewEntry.id) ? '✗ Deselect This Entry' : '✓ Select This Entry'}
                </button>
                <button
                  onClick={() => setPreviewEntry(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#DC2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Preview Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {loadingPreview ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>
                  <div style={{ fontSize: '1rem', marginBottom: '10px' }}>Loading entry details...</div>
                  <div style={{ fontSize: '1.5rem' }}>⏳</div>
                </div>
              ) : previewEntry.data ? (
                <>
                  <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '6px', borderLeft: '4px solid #3B82F6' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#1E40AF' }}>All Fields:</strong>
                  </div>
                  <table style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #E5E7EB', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontWeight: 600, width: '30%', color: '#374151' }}>Field</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontWeight: 600, color: '#374151' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(previewEntry.data)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([field, value]) => (
                        <tr key={field} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '10px 12px', fontWeight: 600, color: '#6B7280', verticalAlign: 'top', fontSize: '0.8125rem' }}>{field}</td>
                          <td style={{ padding: '10px 12px', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '0.8125rem', color: '#111827' }}>
                            {value === null || value === undefined ? (
                              <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>null</span>
                            ) : typeof value === 'object' ? (
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '0.75rem', background: '#F9FAFB', padding: '8px', borderRadius: '4px', color: '#374151' }}>{JSON.stringify(value, null, 2)}</pre>
                            ) : Array.isArray(value) ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {value.map((v, idx) => (
                                  <span key={idx} style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '3px', fontSize: '0.75rem' }}>
                                    {String(v)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#DC2626' }}>
                  <div style={{ fontSize: '1rem', marginBottom: '10px' }}>Failed to load entry data</div>
                  <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>The entry may have been deleted or you may not have access to it.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
