import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TimelineEntry, ColumnDefinition } from '../types';

interface EventClusterViewProps {
  entries: TimelineEntry[];
  columns: ColumnDefinition[];
}

interface Cluster {
  startTime: Date;
  endTime: Date;
  entries: TimelineEntry[];
  expanded: boolean;
}

export default function EventClusterView({ entries, columns }: EventClusterViewProps) {
  const [clusterWindow, setClusterWindow] = useState(1440); // minutes (24 hours default)
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number | null>(null);

  const timestampColumn = columns.find(col => col.column_type === 'timestamp');

  const clusters = useMemo(() => {
    if (!timestampColumn || entries.length === 0) return [];

    // Sort entries by timestamp
    const sortedEntries = [...entries]
      .filter(e => e.data[timestampColumn.name])
      .sort((a, b) => {
        const timeA = new Date(a.data[timestampColumn.name]).getTime();
        const timeB = new Date(b.data[timestampColumn.name]).getTime();
        return timeA - timeB;
      });

    const windowMs = clusterWindow * 60 * 1000;
    const clusterList: Cluster[] = [];
    let currentCluster: TimelineEntry[] = [];
    let clusterStartTime: Date | null = null;

    sortedEntries.forEach(entry => {
      const entryTime = new Date(entry.data[timestampColumn.name]);

      if (currentCluster.length === 0) {
        currentCluster = [entry];
        clusterStartTime = entryTime;
      } else {
        const lastTime = new Date(currentCluster[currentCluster.length - 1].data[timestampColumn.name]);
        const timeDiff = entryTime.getTime() - lastTime.getTime();

        if (timeDiff <= windowMs) {
          currentCluster.push(entry);
        } else {
          clusterList.push({
            startTime: clusterStartTime!,
            endTime: lastTime,
            entries: currentCluster,
            expanded: false,
          });
          currentCluster = [entry];
          clusterStartTime = entryTime;
        }
      }
    });

    // Add last cluster
    if (currentCluster && currentCluster.length > 0 && clusterStartTime) {
      const lastEntry = currentCluster[currentCluster.length - 1];
      clusterList.push({
        startTime: clusterStartTime,
        endTime: new Date(lastEntry.data[timestampColumn.name]),
        entries: currentCluster,
        expanded: false,
      });
    }

    return clusterList;
  }, [entries, timestampColumn, clusterWindow]);

  if (!timestampColumn) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timestamp column found. Add a timestamp column to view clusters.
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No events to cluster
      </div>
    );
  }

  const openClusterModal = (cluster: Cluster, index: number) => {
    setSelectedCluster(cluster);
    setSelectedClusterIndex(index);
  };

  const closeClusterModal = () => {
    setSelectedCluster(null);
    setSelectedClusterIndex(null);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getClusterColor = (count: number) => {
    if (count >= 50) return '#dc3545';
    if (count >= 20) return '#fd7e14';
    if (count >= 10) return '#ffc107';
    if (count >= 5) return '#17a2b8';
    return '#28a745';
  };

  return (
    <div style={{ padding: '20px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ddd', minHeight: '400px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>
            🔍 Event Clusters
          </h4>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {clusters.length} clusters • {entries.length} events • Avg {Math.round(entries.length / clusters.length)} events/cluster
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>
            Cluster window:
          </label>
          <select
            value={clusterWindow}
            onChange={(e) => setClusterWindow(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
            }}
          >
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
            <option value={360}>6 hours</option>
            <option value={1440}>24 hours</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', fontSize: '11px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#28a745', borderRadius: '2px' }} />
          <span>1-4 events</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#17a2b8', borderRadius: '2px' }} />
          <span>5-9 events</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#ffc107', borderRadius: '2px' }} />
          <span>10-19 events</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#fd7e14', borderRadius: '2px' }} />
          <span>20-49 events</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', backgroundColor: '#dc3545', borderRadius: '2px' }} />
          <span>50+ events</span>
        </div>
      </div>

      {/* Clusters */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
        {clusters.map((cluster, idx) => {
          const clusterColor = getClusterColor(cluster.entries.length);

          return (
            <div
              key={idx}
              onClick={() => openClusterModal(cluster, idx)}
              style={{
                border: `2px solid ${clusterColor}`,
                borderRadius: '6px',
                backgroundColor: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div
                style={{
                  padding: '20px',
                  backgroundColor: `${clusterColor}20`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        backgroundColor: clusterColor,
                        color: 'white',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: 700,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      }}
                    >
                      {cluster.entries.length}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 600, color: '#333' }}>
                      Cluster #{idx + 1}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginLeft: '44px' }}>
                    📅 {formatTime(cluster.startTime)} → {formatTime(cluster.endTime)}
                  </div>
                </div>
                <div style={{ fontSize: '20px', color: '#007bff', fontWeight: 'bold' }}>
                  👁️
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '12px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
        💡 Click any cluster to view its events in detail • Adjust cluster window to change grouping
      </div>

      {/* Cluster Modal */}
      {selectedCluster && selectedClusterIndex !== null && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={closeClusterModal}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px',
                borderBottom: '2px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: `${getClusterColor(selectedCluster.entries.length)}15`,
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                  Cluster #{selectedClusterIndex + 1}
                  <span
                    style={{
                      marginLeft: '12px',
                      padding: '4px 12px',
                      backgroundColor: getClusterColor(selectedCluster.entries.length),
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    {selectedCluster.entries.length} events
                  </span>
                </h3>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  📅 {formatTime(selectedCluster.startTime)} → {formatTime(selectedCluster.endTime)}
                </div>
              </div>
              <button
                onClick={closeClusterModal}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
              {selectedCluster.entries.map((entry, entryIdx) => (
                <div
                  key={entry.id}
                  style={{
                    marginBottom: '16px',
                    padding: '16px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: '12px',
                      color: getClusterColor(selectedCluster.entries.length),
                      fontSize: '14px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #ddd',
                    }}
                  >
                    Event {entryIdx + 1} - {formatTime(new Date(entry.data[timestampColumn!.name]))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                    {columns.map(col => (
                      <div key={col.id} style={{ fontSize: '12px' }}>
                        <div style={{ color: '#999', fontWeight: 500, marginBottom: '2px' }}>{col.name}</div>
                        <div style={{ color: '#333', wordBreak: 'break-word' }}>
                          {String(entry.data[col.name] || '-')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
