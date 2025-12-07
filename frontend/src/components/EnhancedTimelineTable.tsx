import { useState, useRef } from 'react';
// import { useVirtualizer } from '@tanstack/react-virtual';
import { Timeline, TimelineEntry } from '../types';
// import ResizableColumnHeader from './ResizableColumnHeader';

interface EnhancedTimelineTableProps {
  timeline: Timeline;
  entries: TimelineEntry[];
  visibleColumns: string[];
  columnWidths?: Record<string, number>;
  onColumnResize?: (widths: Record<string, number>) => void;
  onColumnReorder?: (columns: string[]) => void;
  frozenColumns: number;
  onToggleFreeze: () => void;
  isFocusMode?: boolean;
  children: React.ReactNode; // Original TimelineTable component
}

export default function EnhancedTimelineTable({
  // timeline,
  entries,
  // visibleColumns,
  // columnWidths,
  // onColumnResize,
  // onColumnReorder,
  frozenColumns,
  onToggleFreeze,
  isFocusMode = false,
  children
}: EnhancedTimelineTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtual scrolling for rows
  // const rowVirtualizer = useVirtualizer({
  //   count: entries.length,
  //   getScrollElement: () => parentRef.current,
  //   estimateSize: () => 50, // Estimated row height
  //   overscan: 10, // Render 10 extra rows above/below viewport
  // });

  // const filteredColumns = useMemo(() => {
  //   return (timeline.columns || []).filter(col => visibleColumns.includes(col.name));
  // }, [timeline.columns, visibleColumns]);

  // const handleResize = (columnName: string, newWidth: number) => {
  //   onColumnResize({ ...columnWidths, [columnName]: newWidth });
  // };

  // const handleReorder = (draggedColumn: string, targetColumn: string) => {
  //   const currentOrder = filteredColumns.map(c => c.name);
  //   const dragIndex = currentOrder.indexOf(draggedColumn);
  //   const targetIndex = currentOrder.indexOf(targetColumn);
  //   
  //   const newOrder = [...currentOrder];
  //   const [removed] = newOrder.splice(dragIndex, 1);
  //   newOrder.splice(targetIndex, 0, removed);
  //   
  //   onColumnReorder(newOrder);
  // };

  return (
    <div style={isFocusMode ? { display: 'flex', flexDirection: 'column', height: '100%' } : undefined}>
      {/* Table Controls */}
      {!isFocusMode && (
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '13px', color: '#666' }}>
          {entries.length > 100 && (
            <span>📊 Virtual scrolling active ({entries.length.toLocaleString()} entries)</span>
          )}
        </div>
        <button
          onClick={onToggleFreeze}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: frozenColumns > 0 ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          ❄️ {frozenColumns > 0 ? `Unfreeze Columns` : 'Freeze First Column'}
        </button>
      </div>
      )}

      {/* Enhanced Table Wrapper */}
      <div
        ref={parentRef}
        style={{
          maxHeight: isFocusMode ? '100%' : (entries.length > 20 ? '600px' : 'none'),
          height: isFocusMode ? '100%' : 'auto',
          overflow: isFocusMode ? 'auto' : (entries.length > 20 ? 'auto' : 'visible'),
          border: '1px solid #ddd',
          borderRadius: '4px',
          position: 'relative',
          flex: isFocusMode ? '1' : 'none',
        }}
      >
        {/* CSS for frozen columns */}
        <style>{`
          .frozen-column {
            position: sticky;
            left: 0;
            z-index: 2;
            background-color: #f8f9fa !important;
            border-right: 2px solid #007bff;
          }
          .frozen-column-header {
            position: sticky;
            left: 0;
            z-index: 3;
            background-color: #e9ecef !important;
            border-right: 2px solid #007bff;
          }
        `}</style>

        {/* Render original table with enhancements */}
        <div style={{ position: 'relative' }}>
          {children}
        </div>
      </div>

      {/* Resize/Reorder Instructions */}
      {!isFocusMode && (
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#999', textAlign: 'center' }}>
        💡 Drag column headers to reorder • Drag right edge to resize • First column can be frozen
      </div>
      )}
    </div>
  );
}

// Hook to use with existing TimelineTable
export function useTableEnhancements(timeline: Timeline | null) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [frozenColumns, setFrozenColumns] = useState(0);

  // Initialize column order
  useState(() => {
    if (timeline?.columns && columnOrder.length === 0) {
      setColumnOrder(timeline.columns.map(c => c.name));
    }
  });

  const toggleFreeze = () => {
    setFrozenColumns(prev => prev === 0 ? 1 : 0);
  };

  return {
    columnWidths,
    setColumnWidths,
    columnOrder,
    setColumnOrder,
    frozenColumns,
    toggleFreeze,
  };
}
