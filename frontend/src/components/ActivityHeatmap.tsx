import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { TimelineEntry, ColumnDefinition } from '../types';

interface ActivityHeatmapProps {
  entries: TimelineEntry[];
  columns: ColumnDefinition[];
}

interface HeatmapCell {
  day: string;
  hour: number;
  count: number;
  entries: TimelineEntry[];
}

export default function ActivityHeatmap({ entries, columns }: ActivityHeatmapProps) {
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);
  const timestampColumn = columns.find(col => col.column_type === 'timestamp');

  const filteredEntries = useMemo(() => {
    if (dateRange === 'all' || !timestampColumn) return entries;

    const now = Date.now();
    const cutoffDays = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoffTime = now - (cutoffDays * 24 * 60 * 60 * 1000);

    return entries.filter(entry => {
      const timestamp = entry.data[timestampColumn.name];
      if (!timestamp) return false;
      return new Date(timestamp).getTime() >= cutoffTime;
    });
  }, [entries, dateRange, timestampColumn]);

  const heatmapData = useMemo(() => {
    if (!timestampColumn || filteredEntries.length === 0) return null;

    // Group entries by day and hour
    const dayHourMap = new Map<string, Map<number, TimelineEntry[]>>();
    const allDays = new Set<string>();
    let maxCount = 0;

    filteredEntries.forEach(entry => {
      const timestamp = entry.data[timestampColumn.name];
      if (!timestamp) return;

      const date = new Date(timestamp);
      const day = date.toISOString().split('T')[0]; // YYYY-MM-DD
      const hour = date.getHours();

      if (!dayHourMap.has(day)) {
        dayHourMap.set(day, new Map());
      }

      const hourMap = dayHourMap.get(day)!;
      if (!hourMap.has(hour)) {
        hourMap.set(hour, []);
      }

      hourMap.get(hour)!.push(entry);
      allDays.add(day);

      const count = hourMap.get(hour)!.length;
      if (count > maxCount) maxCount = count;
    });

    // Sort days
    const sortedDays = Array.from(allDays).sort();

    // Create cells
    const cells: HeatmapCell[] = [];
    sortedDays.forEach(day => {
      for (let hour = 0; hour < 24; hour++) {
        const hourEntries = dayHourMap.get(day)?.get(hour) || [];
        cells.push({
          day,
          hour,
          count: hourEntries.length,
          entries: hourEntries,
        });
      }
    });

    return {
      cells,
      days: sortedDays,
      maxCount,
    };
  }, [filteredEntries, timestampColumn]);

  if (!timestampColumn) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timestamp column found. Add a timestamp column to view the heatmap.
      </div>
    );
  }

  if (!heatmapData || heatmapData.days.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No activity data to display
      </div>
    );
  }

  const getColor = (count: number) => {
    if (count === 0) return '#f0f0f0';
    const intensity = Math.min(count / heatmapData.maxCount, 1);
    
    // Blue gradient
    const r = Math.floor(255 - (255 - 0) * intensity);
    const g = Math.floor(255 - (255 - 123) * intensity);
    const b = Math.floor(255 - (255 - 255) * intensity);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const formatDay = (day: string) => {
    const date = new Date(day + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const cellSize = 24;
  const dayLabelWidth = 70;
  const hourLabelHeight = 20;

  return (
    <div style={{ padding: '16px', overflowX: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
            🔥 Activity Heatmap
          </h4>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {filteredEntries.length} events across {heatmapData.days.length} days
            {dateRange !== 'all' && <span style={{ color: '#007bff', marginLeft: '8px' }}>(filtered)</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setDateRange('7d')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: dateRange === '7d' ? '#007bff' : '#e9ecef',
              color: dateRange === '7d' ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: dateRange === '7d' ? 600 : 400,
            }}
          >
            Last 7 days
          </button>
          <button
            onClick={() => setDateRange('30d')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: dateRange === '30d' ? '#007bff' : '#e9ecef',
              color: dateRange === '30d' ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: dateRange === '30d' ? 600 : 400,
            }}
          >
            Last 30 days
          </button>
          <button
            onClick={() => setDateRange('90d')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: dateRange === '90d' ? '#007bff' : '#e9ecef',
              color: dateRange === '90d' ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: dateRange === '90d' ? 600 : 400,
            }}
          >
            Last 90 days
          </button>
          <button
            onClick={() => setDateRange('all')}
            style={{
              padding: '6px 12px',
              fontSize: '11px',
              backgroundColor: dateRange === 'all' ? '#007bff' : '#e9ecef',
              color: dateRange === 'all' ? 'white' : '#333',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: dateRange === 'all' ? 600 : 400,
            }}
          >
            All time
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '11px' }}>
        <span style={{ color: '#666' }}>Activity:</span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[0, 0.25, 0.5, 0.75, 1].map(intensity => (
            <div
              key={intensity}
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: getColor(Math.ceil(heatmapData.maxCount * intensity)),
                border: '1px solid #ddd',
                borderRadius: '2px',
              }}
            />
          ))}
        </div>
        <span style={{ color: '#666' }}>Low → High</span>
        <span style={{ color: '#999', marginLeft: '8px' }}>Max: {heatmapData.maxCount} events/hour</span>
      </div>

      {/* Heatmap */}
      <div style={{ display: 'inline-block', backgroundColor: 'white', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}>
        <div style={{ display: 'flex' }}>
          {/* Day labels */}
          <div style={{ width: `${dayLabelWidth}px`, marginRight: '4px' }}>
            <div style={{ height: `${hourLabelHeight}px` }} />
            {heatmapData.days.map(day => (
              <div
                key={day}
                style={{
                  height: `${cellSize}px`,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '10px',
                  color: '#666',
                  paddingRight: '8px',
                  justifyContent: 'flex-end',
                }}
              >
                {formatDay(day)}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <div>
            {/* Hour labels */}
            <div style={{ display: 'flex', height: `${hourLabelHeight}px`, marginBottom: '2px' }}>
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  style={{
                    width: `${cellSize}px`,
                    fontSize: '9px',
                    color: '#666',
                    textAlign: 'center',
                    display: hour % 3 === 0 ? 'block' : 'none',
                  }}
                >
                  {hour}
                </div>
              ))}
            </div>

            {/* Cells */}
            {heatmapData.days.map(day => (
              <div key={day} style={{ display: 'flex', gap: '1px', marginBottom: '1px' }}>
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = heatmapData.cells.find(c => c.day === day && c.hour === hour);
                  const count = cell?.count || 0;
                  const color = getColor(count);

                  return (
                    <div
                      key={hour}
                      title={`${formatDay(day)} ${hour}:00 - ${count} events`}
                      onClick={() => {
                        if (count > 0 && cell) {
                          setSelectedCell(cell);
                        }
                      }}
                      style={{
                        width: `${cellSize}px`,
                        height: `${cellSize}px`,
                        backgroundColor: color,
                        border: '1px solid #fff',
                        cursor: count > 0 ? 'pointer' : 'default',
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={(e) => {
                        if (count > 0) {
                          e.currentTarget.style.transform = 'scale(1.2)';
                          e.currentTarget.style.zIndex = '10';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.zIndex = '1';
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ marginTop: '16px', display: 'flex', gap: '16px', fontSize: '11px', color: '#666', flexWrap: 'wrap' }}>
        <div>
          📊 <strong>Showing:</strong> {filteredEntries.length} of {entries.length} events
        </div>
        <div>
          📅 <strong>Date Range:</strong> {formatDay(heatmapData.days[0])} → {formatDay(heatmapData.days[heatmapData.days.length - 1])}
        </div>
        <div>
          ⚡ <strong>Peak Activity:</strong> {heatmapData.maxCount} events in one hour
        </div>
      </div>

      <div style={{ marginTop: '12px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
        💡 Click cells to view events • Darker colors indicate higher activity
      </div>

      {/* Cell Detail Modal */}
      {selectedCell && createPortal(
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
          onClick={() => setSelectedCell(null)}
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
                backgroundColor: '#007bff15',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                  {formatDay(selectedCell.day)} - {selectedCell.hour}:00
                  <span
                    style={{
                      marginLeft: '12px',
                      padding: '4px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    {selectedCell.count} events
                  </span>
                </h3>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Events occurring during this hour
                </div>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
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
              {selectedCell.entries.map((entry, entryIdx) => (
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
                      color: '#007bff',
                      fontSize: '14px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #ddd',
                    }}
                  >
                    Event {entryIdx + 1} - {new Date(entry.data[timestampColumn!.name]).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
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
