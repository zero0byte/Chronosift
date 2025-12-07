import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
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

export default function ProjectSearchPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const [project, setProject] = useState<any>(null);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
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

  // Load project and timelines
  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await projectAPI.get(Number(id));
        setProject(response.data.project);
        setTimelines(response.data.timelines || []);
      } catch (error) {
        console.error('Failed to load project:', error);
      }
    };
    loadProject();
  }, [id]);

  // Read URL parameters and auto-search
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const kw = searchParams.get('keyword');

    if (start && end) {
      // Convert ISO timestamps to date input format (YYYY-MM-DDTHH:mm)
      const startDateObj = new Date(start);
      const endDateObj = new Date(end);
      
      // Format to datetime-local input format
      const formatForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      setStartDate(formatForInput(startDateObj));
      setEndDate(formatForInput(endDateObj));
      
      // Auto-execute search after a short delay to ensure state is set
      setTimeout(() => {
        handleSearch(0, formatForInput(startDateObj), formatForInput(endDateObj), kw || '');
      }, 100);
    } else if (kw) {
      setKeyword(kw);
      setTimeout(() => {
        handleSearch(0, '', '', kw);
      }, 100);
    }
  }, [location.search]);

  const handleSearch = async (newOffset: number = 0, startOverride?: string, endOverride?: string, keywordOverride?: string) => {
    const finalStart = startOverride !== undefined ? startOverride : startDate;
    const finalEnd = endOverride !== undefined ? endOverride : endDate;
    const finalKeyword = keywordOverride !== undefined ? keywordOverride : keyword;

    if (!finalKeyword && !finalStart && !finalEnd) {
      setError('Please enter a keyword or select a date range');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params: any = { limit, offset: newOffset };
      
      if (finalKeyword) params.keyword = finalKeyword;
      if (finalStart) params.start_date = new Date(finalStart).toISOString();
      if (finalEnd) params.end_date = new Date(finalEnd).toISOString();
      if (selectedTimelines.length > 0) params.timeline_ids = selectedTimelines;

      const response = await projectAPI.search(Number(id), params);
      
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

  const handleResultClick = (result: SearchResult) => {
    // Navigate to timeline with entry parameter for highlighting and scrolling
    navigate(`/timelines/${result.timeline.id}?entry=${result.id}`);
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
    // Show up to 6 most relevant fields
    return allFields.slice(0, 6);
  };

  if (!project) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(`/projects/${id}`)} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back to Project</button>
          <h1 style={{ margin: 0 }}>Search: {project.name}</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        {/* Search Form */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ marginTop: 0, marginBottom: '20px' }}>🔍 Project-Wide Search</h2>

          {/* Keyword */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
              Keyword
            </label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search for any text..."
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(0)}
            />
          </div>

          {/* Date Range */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '15px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
                Start Date and Time
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 600 }}>
                End Date and Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
              />
            </div>
          </div>

          {/* Timeline Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>
              Timelines (leave empty to search all)
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {timelines.map(timeline => (
                <label
                  key={timeline.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: selectedTimelines.includes(timeline.id) ? '#e3f2fd' : '#fff'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTimelines.includes(timeline.id)}
                    onChange={() => toggleTimeline(timeline.id)}
                    style={{ marginRight: '6px' }}
                  />
                  {timeline.name}
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleSearch(0)}
            disabled={loading}
            style={{
              padding: '10px 24px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            {loading ? 'Searching...' : '🔍 Search'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', padding: '12px', marginBottom: '20px', color: '#721c24' }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #e0e0e0' }}>
              <h3 style={{ margin: 0 }}>
                Found {total} result{total !== 1 ? 's' : ''} across {new Set(results.map(r => r.timeline.id)).size} timeline{new Set(results.map(r => r.timeline.id)).size !== 1 ? 's' : ''}
              </h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '150px', position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 1 }}>Timeline</th>
                    {getDisplayFields(results).map(field => (
                      <th key={field} style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '14px', minWidth: '150px', maxWidth: '300px' }}>
                        {field}
                      </th>
                    ))}
                    <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: '14px', width: '100px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr 
                      key={`${result.timeline.id}-${result.id}`}
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
                          padding: '12px', 
                          fontSize: '13px', 
                          fontWeight: 600, 
                          color: '#007bff',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: 'inherit',
                          zIndex: 1
                        }}
                      >
                        📋 {result.timeline.name}
                      </td>
                      {getDisplayFields(results).map(field => {
                        const value = result.data[field];
                        const isTimestamp = field.toLowerCase().includes('timestamp') || field.toLowerCase().includes('time');
                        const displayValue = isTimestamp && value ? formatDate(value) : renderCellValue(value);
                        
                        return (
                          <td 
                            key={field}
                            style={{ 
                              padding: '12px', 
                              fontSize: '13px',
                              maxWidth: '300px',
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
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => handleResultClick(result)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#007bff',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
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

            {hasMore && (
              <div style={{ padding: '20px', textAlign: 'center', borderTop: '1px solid #e0e0e0' }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loading}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
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
          </div>
        )}

        {!loading && results.length === 0 && (startDate || endDate || keyword) && (
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#666' }}>
            No results found. Try adjusting your search criteria.
          </div>
        )}
      </div>
    </div>
  );
}
