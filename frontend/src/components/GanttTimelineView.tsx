import { useState, useRef, useMemo } from 'react';
import { TimelineEntry, ColumnDefinition } from '../types';

interface GanttTimelineViewProps {
  entries: TimelineEntry[];
  columns: ColumnDefinition[];
  onSelectEntry?: (entry: TimelineEntry) => void;
}

export default function GanttTimelineView({ entries, columns, onSelectEntry }: GanttTimelineViewProps) {
  const [zoom, setZoom] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const timestampColumn = columns.find(col => col.column_type === 'timestamp');

  const ganttData = useMemo(() => {
    if (!timestampColumn || entries.length === 0) return null;

    // Extract timestamps
    const times = entries
      .map(e => e.data[timestampColumn.name])
      .filter(Boolean)
      .map(t => new Date(t).getTime())
      .sort((a, b) => a - b);

    if (times.length === 0) return null;

    const minTime = times[0];
    const maxTime = times[times.length - 1];
    const timeRange = maxTime - minTime || 1;

    // Create gantt items
    const items = entries
      .filter(e => e.data[timestampColumn.name])
      .map((entry, idx) => {
        const timestamp = new Date(entry.data[timestampColumn.name]).getTime();
        const position = ((timestamp - minTime) / timeRange) * 100;
        
        // Get description
        const descCol = columns.find(c => c.name.toLowerCase().includes('description') || c.name.toLowerCase().includes('name'));
        const description = descCol ? String(entry.data[descCol.name] || 'Event') : 'Event';

        return {
          entry,
          timestamp,
          position,
          description: description.substring(0, 50),
          yPosition: (idx % 10) * 40 + 20, // Stack events
        };
      });

    return {
      minTime: new Date(minTime),
      maxTime: new Date(maxTime),
      timeRange,
      items,
    };
  }, [entries, columns, timestampColumn]);

  if (!timestampColumn) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timestamp column found. Add a timestamp column to view the Gantt chart.
      </div>
    );
  }

  if (!ganttData || ganttData.items.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        No timeline data to display
      </div>
    );
  }

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.5, 10));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.5, 0.5));

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const svgHeight = Math.max(400, ganttData.items.length * 4);

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '16px', backgroundColor: 'white' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>📅 Gantt Timeline View</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#666' }}>
            {formatDate(ganttData.minTime)} → {formatDate(ganttData.maxTime)}
          </span>
          <button
            onClick={handleZoomOut}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🔍−
          </button>
          <button
            onClick={handleZoomIn}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            🔍+
          </button>
        </div>
      </div>

      {/* Timeline */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '500px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
        <svg
          ref={svgRef}
          width={`${100 * zoom}%`}
          height={svgHeight}
          style={{ minWidth: '600px', display: 'block' }}
        >
          {/* Time axis */}
          <line x1="0" y1="15" x2="100%" y2="15" stroke="#ccc" strokeWidth="2" />
          
          {/* Time markers */}
          {[0, 25, 50, 75, 100].map(percent => {
            const time = new Date(ganttData.minTime.getTime() + (ganttData.timeRange * percent / 100));
            return (
              <g key={percent}>
                <line
                  x1={`${percent}%`}
                  y1="10"
                  x2={`${percent}%`}
                  y2={svgHeight}
                  stroke="#e0e0e0"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={`${percent}%`}
                  y="10"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#666"
                >
                  {formatDate(time)}
                </text>
              </g>
            );
          })}

          {/* Events */}
          {ganttData.items.map((item, idx) => (
            <g
              key={idx}
              onClick={() => {
                setSelectedEntry(item.entry);
                onSelectEntry?.(item.entry);
              }}
              style={{ cursor: 'pointer' }}
            >
              {/* Event marker */}
              <circle
                cx={`${item.position}%`}
                cy={item.yPosition}
                r="4"
                fill={selectedEntry?.id === item.entry.id ? '#dc3545' : '#007bff'}
                stroke="white"
                strokeWidth="2"
              />
              
              {/* Event label (on hover or selected) */}
              {selectedEntry?.id === item.entry.id && (
                <>
                  <rect
                    x={`calc(${item.position}% + 10px)`}
                    y={item.yPosition - 15}
                    width="200"
                    height="30"
                    fill="white"
                    stroke="#007bff"
                    strokeWidth="1"
                    rx="4"
                  />
                  <text
                    x={`calc(${item.position}% + 15px)`}
                    y={item.yPosition}
                    fontSize="11"
                    fill="#333"
                  >
                    {item.description}
                  </text>
                </>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Selected Event Details */}
      {selectedEntry && (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'white', border: '1px solid #007bff', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#007bff' }}>
                Selected Event
              </div>
              {columns.slice(0, 5).map(col => (
                <div key={col.id} style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500, color: '#666' }}>{col.name}:</span>{' '}
                  <span>{String(selectedEntry.data[col.name] || '-')}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedEntry(null)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
        💡 Click events to see details • Use zoom buttons to adjust view
      </div>
    </div>
  );
}
