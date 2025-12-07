import { useState, useRef, useEffect } from 'react';

interface KeyTimestamp {
  id: number;
  timestamp: string;
  label: string;
  description?: string;
  color: string;
}

interface TimelineEntry {
  id: number;
  timestamp: string;
  timeline_name: string;
  data: any;
}

interface TimelineGraphProps {
  keyTimestamps: KeyTimestamp[];
  entries?: TimelineEntry[];
  onTimestampClick?: (timestamp: KeyTimestamp) => void;
  onEntryClick?: (entry: TimelineEntry) => void;
  height?: number;
}

export default function TimelineGraph({
  keyTimestamps,
  entries = [],
  onTimestampClick,
  onEntryClick,
  height = 400
}: TimelineGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(1000);

  // Responsive width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate time range
  const allTimestamps = [
    ...keyTimestamps.map(kt => new Date(kt.timestamp).getTime()),
    ...entries.map(e => new Date(e.timestamp).getTime())
  ];

  const minTime = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now();
  const maxTime = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now() + 86400000;
  const timeRange = maxTime - minTime || 86400000; // Default to 1 day if no range

  // Convert timestamp to X coordinate
  const timeToX = (timestamp: string): number => {
    const time = new Date(timestamp).getTime();
    const normalizedTime = (time - minTime) / timeRange;
    const padding = 80;
    const usableWidth = (containerWidth - padding * 2) * zoom;
    return padding + normalizedTime * usableWidth + panX;
  };

  // Mouse handlers for pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setDragStart({ x: e.clientX - panX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPanX(e.clientX - dragStart.x);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(10, prev * zoomFactor)));
  };

  // Format time for display
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Group entries by timeline
  const entriesByTimeline = entries.reduce((acc, entry) => {
    if (!acc[entry.timeline_name]) {
      acc[entry.timeline_name] = [];
    }
    acc[entry.timeline_name].push(entry);
    return acc;
  }, {} as Record<string, TimelineEntry[]>);

  const timelineNames = Object.keys(entriesByTimeline);
  const timelineLaneHeight = 40;
  const keyTimestampLaneY = 100;

  return (
    <div style={{ padding: '20px', background: 'white', borderRadius: 'var(--radius-xl)', border: '1px solid var(--gray-200)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>📊 Timeline Visualization</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: 'var(--gray-600)' }}>
            {keyTimestamps.length} key timestamps • {entries.length} entries • {timelineNames.length} timelines
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setZoom(prev => Math.min(10, prev * 1.2))}
            style={{
              padding: '6px 12px',
              background: 'var(--gray-100)',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔍+
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.5, prev * 0.8))}
            style={{
              padding: '6px 12px',
              background: 'var(--gray-100)',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            🔍-
          </button>
          <button
            onClick={() => { setZoom(1); setPanX(0); }}
            style={{
              padding: '6px 12px',
              background: 'var(--gray-100)',
              border: '1px solid var(--gray-300)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Reset
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
            Zoom: {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        marginBottom: '16px', 
        padding: '12px',
        background: 'var(--gray-50)',
        borderRadius: 'var(--radius-lg)',
        fontSize: '0.8125rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent-pink)' }} />
          <span>Key Timestamps</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '16px', height: '4px', background: 'var(--accent-blue)' }} />
          <span>Timeline Entries</span>
        </div>
        <div style={{ color: 'var(--gray-600)', marginLeft: 'auto' }}>
          💡 Scroll to zoom • Drag to pan • Click items for details
        </div>
      </div>

      {/* SVG Timeline */}
      <div 
        ref={containerRef}
        style={{ 
          border: '1px solid var(--gray-300)', 
          borderRadius: 'var(--radius-lg)', 
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <svg
          ref={svgRef}
          width="100%"
          height={height}
          style={{ display: 'block' }}
        >
          {/* Time axis */}
          <line
            x1={40}
            y1={keyTimestampLaneY}
            x2={containerWidth - 40}
            y2={keyTimestampLaneY}
            stroke="var(--gray-300)"
            strokeWidth={2}
          />

          {/* Time markers */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const time = minTime + timeRange * fraction;
            const x = 80 + (containerWidth - 160) * fraction * zoom + panX;
            const timestamp = new Date(time).toISOString();
            
            if (x < 40 || x > containerWidth - 40) return null;
            
            return (
              <g key={fraction}>
                <line
                  x1={x}
                  y1={keyTimestampLaneY - 10}
                  x2={x}
                  y2={keyTimestampLaneY + 10}
                  stroke="var(--gray-400)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={keyTimestampLaneY - 20}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--gray-600)"
                >
                  {formatDate(timestamp)}
                </text>
              </g>
            );
          })}

          {/* Key Timestamps */}
          {keyTimestamps.map((kt) => {
            const x = timeToX(kt.timestamp);
            if (x < 0 || x > containerWidth) return null;

            const isHovered = hoveredItem === `kt-${kt.id}`;
            
            return (
              <g 
                key={`kt-${kt.id}`}
                onClick={() => onTimestampClick?.(kt)}
                onMouseEnter={() => setHoveredItem(`kt-${kt.id}`)}
                onMouseLeave={() => setHoveredItem(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Vertical line */}
                <line
                  x1={x}
                  y1={keyTimestampLaneY}
                  x2={x}
                  y2={height - 20}
                  stroke={kt.color}
                  strokeWidth={isHovered ? 3 : 2}
                  strokeDasharray="4,4"
                  opacity={0.6}
                />
                
                {/* Circle marker */}
                <circle
                  cx={x}
                  cy={keyTimestampLaneY}
                  r={isHovered ? 10 : 8}
                  fill={kt.color}
                  stroke="white"
                  strokeWidth={2}
                />
                
                {/* Label */}
                <text
                  x={x}
                  y={keyTimestampLaneY - 40}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={kt.color}
                >
                  {kt.label}
                </text>
                <text
                  x={x}
                  y={keyTimestampLaneY - 28}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--gray-600)"
                >
                  {formatTime(kt.timestamp)}
                </text>

                {/* Tooltip on hover */}
                {isHovered && kt.description && (
                  <g>
                    <rect
                      x={x - 100}
                      y={keyTimestampLaneY + 15}
                      width={200}
                      height={40}
                      fill="white"
                      stroke={kt.color}
                      strokeWidth={2}
                      rx={6}
                    />
                    <text
                      x={x}
                      y={keyTimestampLaneY + 35}
                      textAnchor="middle"
                      fontSize="10"
                      fill="var(--gray-800)"
                    >
                      {kt.description.substring(0, 30)}...
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Timeline Entries */}
          {timelineNames.map((timelineName, idx) => {
            const laneY = keyTimestampLaneY + 80 + idx * timelineLaneHeight;
            const timelineEntries = entriesByTimeline[timelineName];
            
            return (
              <g key={timelineName}>
                {/* Timeline label */}
                <text
                  x={10}
                  y={laneY}
                  fontSize="10"
                  fontWeight="500"
                  fill="var(--gray-700)"
                >
                  {timelineName.substring(0, 12)}
                </text>
                
                {/* Timeline lane line */}
                <line
                  x1={80}
                  y1={laneY}
                  x2={containerWidth - 40}
                  y2={laneY}
                  stroke="var(--gray-200)"
                  strokeWidth={1}
                />
                
                {/* Entry markers */}
                {timelineEntries.map((entry) => {
                  const x = timeToX(entry.timestamp);
                  if (x < 40 || x > containerWidth - 40) return null;
                  
                  const isHovered = hoveredItem === `entry-${entry.id}`;
                  
                  return (
                    <rect
                      key={entry.id}
                      x={x - 2}
                      y={laneY - 6}
                      width={4}
                      height={12}
                      fill="var(--accent-blue)"
                      opacity={isHovered ? 1 : 0.7}
                      rx={1}
                      onClick={() => onEntryClick?.(entry)}
                      onMouseEnter={() => setHoveredItem(`entry-${entry.id}`)}
                      onMouseLeave={() => setHoveredItem(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Empty state */}
      {keyTimestamps.length === 0 && entries.length === 0 && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: 'var(--gray-500)'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📊</div>
          <div>No data to visualize</div>
          <div style={{ fontSize: '0.875rem' }}>Create key timestamps to see them here</div>
        </div>
      )}
    </div>
  );
}
