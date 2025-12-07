import { useState } from 'react';
import { keyTimestampsAPI } from '../lib/api';

interface TimelineEntry {
  id: number;
  data: any;
  timeline: {
    id: number;
    name: string;
    is_master: boolean;
  };
  timestamp_column: string;
}

interface SearchResult {
  key_timestamp: {
    id: number;
    label: string;
    timestamp: string;
  };
  results: TimelineEntry[];
  total_entries: number;
  time_window: {
    start: string;
    end: string;
    window_minutes: number;
  };
}

interface KeyTimestampSearchProps {
  projectId: number;
  timestampId?: number;
  onClose?: () => void;
}

export default function KeyTimestampSearch({ projectId, timestampId, onClose }: KeyTimestampSearchProps) {
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeWindow, setTimeWindow] = useState(30); // minutes
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!timestampId) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await keyTimestampsAPI.searchAround(projectId, timestampId, { window_minutes: timeWindow });
      setResults(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to search');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: string) => {
    return new Date(ts).toLocaleString();
  };

  const renderEntryData = (data: any) => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      return (
        <pre style={{
          background: 'var(--gray-50)',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          overflow: 'auto',
          maxHeight: '200px',
          margin: '8px 0 0 0'
        }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }
    return String(data);
  };

  const groupByTimeline = (entries: TimelineEntry[]) => {
    const grouped = entries.reduce((acc, entry) => {
      const timelineName = entry.timeline.name;
      if (!acc[timelineName]) {
        acc[timelineName] = [];
      }
      acc[timelineName].push(entry);
      return acc;
    }, {} as Record<string, TimelineEntry[]>);
    return grouped;
  };

  const getEntryTimestamp = (entry: TimelineEntry): string => {
    return entry.data[entry.timestamp_column] || '';
  };

  return (
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
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-2xl)',
        padding: '32px',
        maxWidth: '1200px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: 'var(--shadow-xl)'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
              🔍 Search Key Timestamp
            </h3>
            <p style={{ color: 'var(--gray-600)', margin: 0 }}>
              Find entries across all timelines within a time window
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: 'var(--gray-500)'
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Search Controls */}
        <div style={{ 
          display: 'flex', 
          gap: '12px', 
          alignItems: 'center', 
          marginBottom: '24px',
          padding: '20px',
          background: 'var(--gray-50)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: 600,
              color: 'var(--gray-900)'
            }}>
              Time Window (minutes)
            </label>
            <input
              type="number"
              value={timeWindow}
              onChange={(e) => setTimeWindow(Number(e.target.value))}
              min={1}
              max={1440}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '1rem',
                border: '1px solid var(--gray-300)',
                borderRadius: 'var(--radius-md)',
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '4px' }}>
              ± {timeWindow} minutes ({timeWindow * 2} minute window)
            </div>
          </div>
          <div style={{ paddingTop: '28px' }}>
            <button
              onClick={handleSearch}
              disabled={loading || !timestampId}
              style={{
                padding: '12px 32px',
                background: loading ? 'var(--gray-400)' : 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {loading ? 'Searching...' : '🔍 Search'}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '16px',
            background: 'rgba(220, 38, 38, 0.1)',
            color: 'var(--error)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '24px',
            fontWeight: 500
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div>
            {/* Results Header */}
            <div style={{
              padding: '16px 20px',
              background: 'var(--accent-blue)',
              color: 'white',
              borderRadius: 'var(--radius-lg)',
              marginBottom: '20px'
            }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '4px' }}>
                {results.key_timestamp.label}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                ⏰ {formatTimestamp(results.key_timestamp.timestamp)}
              </div>
              <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '8px' }}>
                Found {results.total_entries} entries across {Object.keys(groupByTimeline(results.results || [])).length} timelines
              </div>
            </div>

            {/* No Results */}
            {!results.results || results.results.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-xl)',
                border: '2px dashed var(--gray-300)'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
                <h4 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--gray-900)', marginBottom: '8px' }}>
                  No Entries Found
                </h4>
                <p style={{ color: 'var(--gray-600)' }}>
                  Try expanding the time window to find more entries
                </p>
              </div>
            ) : (
              /* Grouped Results */
              <div>
                {Object.entries(groupByTimeline(results.results || [])).map(([timelineName, entries]) => (
                  <div key={timelineName} style={{ marginBottom: '32px' }}>
                    {/* Timeline Header */}
                    <div style={{
                      padding: '12px 16px',
                      background: 'var(--gray-100)',
                      borderRadius: 'var(--radius-lg)',
                      marginBottom: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <h4 style={{ 
                        fontSize: '1rem', 
                        fontWeight: 600, 
                        color: 'var(--gray-900)',
                        margin: 0 
                      }}>
                        📊 {timelineName}
                      </h4>
                      <span style={{
                        padding: '4px 12px',
                        background: 'var(--accent-blue)',
                        color: 'white',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>

                    {/* Timeline Entries */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            background: 'white',
                            border: '1px solid var(--gray-200)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '16px',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <div style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: 'var(--accent-blue)',
                              fontFamily: 'monospace'
                            }}>
                              ⏰ {formatTimestamp(getEntryTimestamp(entry))}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.9375rem', color: 'var(--gray-800)' }}>
                            {renderEntryData(entry.data)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!results && !loading && !error && (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-xl)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔍</div>
            <p style={{ color: 'var(--gray-600)' }}>
              Configure the time window and click Search to find entries
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
