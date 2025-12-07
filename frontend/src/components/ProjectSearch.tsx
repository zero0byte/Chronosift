import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectAPI } from '../lib/api';

interface Timeline {
  id: number;
  name: string;
  is_master: boolean;
}

interface SearchResult {
  id: number;
  data: any;
  timeline: Timeline;
}

interface ProjectSearchProps {
  projectId: number;
  timelines: Timeline[];
  onClose?: () => void;
  isModal?: boolean;
}

export default function ProjectSearch({ projectId, timelines, onClose, isModal = false }: ProjectSearchProps) {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTimelines, setSelectedTimelines] = useState<number[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const handleSearch = async (newOffset: number = 0) => {
    if (!keyword && !startDate && !endDate) {
      setError('Please enter a keyword or select a date range');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = { limit, offset: newOffset };
      
      if (keyword) params.keyword = keyword;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      if (selectedTimelines.length > 0) params.timeline_ids = selectedTimelines;

      const response = await projectAPI.search(projectId, params);
      
      if (newOffset === 0) {
        setResults(response.data.results);
      } else {
        setResults(prev => [...prev, ...response.data.results]);
      }
      
      setTotal(response.data.total);
      setHasMore(response.data.has_more);
      setOffset(newOffset);
    } catch (err: any) {
      console.error('Search failed:', err);
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(offset + limit);
  };

  const handleResultClick = (result: SearchResult, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Open in new tab with entry parameter for highlighting and scrolling
    // Use absolute URL to ensure query params work correctly
    const url = `${window.location.origin}/timelines/${result.timeline.id}?entry=${result.id}`;
    window.open(url, '_blank');
    
    // Keep modal open so user can continue browsing results
  };

  const toggleTimeline = (timelineId: number) => {
    setSelectedTimelines(prev => 
      prev.includes(timelineId) 
        ? prev.filter(id => id !== timelineId)
        : [...prev, timelineId]
    );
  };

  const formatDate = (value: any) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  };

  const renderCellValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };

  // Get all unique field names from results
  const getAllFields = (results: SearchResult[]) => {
    const fieldSet = new Set<string>();
    results.forEach(result => {
      Object.keys(result.data).forEach(key => fieldSet.add(key));
    });
    // Prioritize common fields
    const priorityFields = ['Timestamp', 'timestamp', 'Description', 'EventDescription', 'Event Name', 'Type', 'Source', 'Computer', 'User'];
    const allFields = Array.from(fieldSet);
    const orderedFields = [
      ...priorityFields.filter(f => allFields.includes(f)),
      ...allFields.filter(f => !priorityFields.includes(f)).sort()
    ];
    return orderedFields;
  };

  const getDisplayFields = (results: SearchResult[]) => {
    if (results.length === 0) return [];
    const allFields = getAllFields(results);
    // Show up to 5 most relevant fields (less than full page since modal is smaller)
    return allFields.slice(0, 5);
  };

  const containerStyle: React.CSSProperties = isModal ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  } : {};

  const contentStyle: React.CSSProperties = isModal ? {
    backgroundColor: '#fff',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '1200px',
    height: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
  } : {
    display: 'flex',
    flexDirection: 'column',
    height: '100%'
  };

  return (
    <div style={containerStyle} onClick={isModal ? onClose : undefined}>
      <div style={contentStyle} onClick={(e) => isModal && e.stopPropagation()}>
        {/* Search Form */}
        <div style={{ padding: '20px', borderBottom: '1px solid #ddd', backgroundColor: '#f8f9fa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Search Project</h3>
            {isModal && onClose && (
              <button
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                ✕ Close
              </button>
            )}
          </div>
        
        {/* Keyword Search */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
            Keyword
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search for any text..."
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ddd', 
              borderRadius: '4px',
              fontSize: '14px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(0);
              }
            }}
          />
        </div>

        {/* Date Range */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
              Start Date
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
              End Date
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ddd', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {/* Timeline Filter */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
            Filter by Timelines (optional)
          </label>
          <div style={{ 
            maxHeight: '120px', 
            overflowY: 'auto', 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            padding: '8px',
            backgroundColor: '#fff'
          }}>
            {timelines.map(timeline => (
              <label 
                key={timeline.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '4px 0',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTimelines.includes(timeline.id)}
                  onChange={() => toggleTimeline(timeline.id)}
                  style={{ marginRight: '8px' }}
                />
                {timeline.name}
                {timeline.is_master && <span style={{ marginLeft: '8px', color: '#ffc107', fontSize: '12px' }}>⭐ Master</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <button
          onClick={() => handleSearch(0)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#007bff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          {loading ? '🔍 Searching...' : '🔍 Search'}
        </button>

        {error && (
          <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8d7da', color: '#721c24', borderRadius: '4px', fontSize: '14px' }}>
            {error}
          </div>
        )}
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #ddd' }}>
        {results.length > 0 && (
          <>
            <div style={{ padding: '15px 20px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
              <div style={{ fontSize: '14px', color: '#333', fontWeight: 600 }}>
                Found {total} result{total !== 1 ? 's' : ''} across {new Set(results.map(r => r.timeline.id)).size} timeline{new Set(results.map(r => r.timeline.id)).size !== 1 ? 's' : ''}
              </div>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px', minWidth: '120px', position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>Timeline</th>
                    {getDisplayFields(results).map(field => (
                      <th key={field} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px', minWidth: '150px', maxWidth: '250px' }}>
                        {field}
                      </th>
                    ))}
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '13px', width: '80px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr 
                      key={result.id}
                      style={{ 
                        borderBottom: '1px solid #e0e0e0',
                        transition: 'background-color 0.15s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8f9fa';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <td 
                        style={{ 
                          padding: '10px 12px', 
                          fontSize: '12px', 
                          fontWeight: 600,
                          position: 'sticky',
                          left: 0,
                          backgroundColor: 'inherit',
                          zIndex: 1
                        }}
                      >
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 6px',
                          backgroundColor: result.timeline.is_master ? '#ffc107' : '#6c757d',
                          color: '#fff',
                          borderRadius: '3px',
                          fontSize: '11px'
                        }}>
                          {result.timeline.name}
                        </span>
                      </td>
                      {getDisplayFields(results).map(field => {
                        const value = result.data[field];
                        const isTimestamp = field.toLowerCase().includes('timestamp') || field.toLowerCase().includes('time');
                        const displayValue = isTimestamp && value ? formatDate(value) : renderCellValue(value);
                        
                        return (
                          <td 
                            key={field}
                            style={{ 
                              padding: '10px 12px', 
                              fontSize: '12px',
                              maxWidth: '250px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={String(displayValue)}
                          >
                            {displayValue}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={(e) => handleResultClick(result, e)}
                          style={{
                            padding: '4px 10px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#0056b3';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#007bff';
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Load More */}
            {hasMore && (
              <div style={{ padding: '15px 20px', borderTop: '1px solid #e0e0e0', textAlign: 'center' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) e.currentTarget.style.backgroundColor = '#218838';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#28a745';
                  }}
                >
                  {loading ? 'Loading...' : '📥 Load More'}
                </button>
              </div>
            )}
          </>
        )}

        {results.length === 0 && !loading && !error && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔍</div>
            <div style={{ fontSize: '16px' }}>Enter search criteria and click Search</div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
