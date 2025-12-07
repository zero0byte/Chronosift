import { useState } from 'react';
import { ColumnDefinition } from '../types';

interface ColumnVisibilityToggleProps {
  columns: ColumnDefinition[];
  visibleColumns: string[];
  onToggle: (columnNames: string[]) => void;
}

export default function ColumnVisibilityToggle({ columns, visibleColumns, onToggle }: ColumnVisibilityToggleProps) {
  const [expanded, setExpanded] = useState(false);

  const toggleColumn = (columnName: string) => {
    if (visibleColumns.includes(columnName)) {
      onToggle(visibleColumns.filter(c => c !== columnName));
    } else {
      onToggle([...visibleColumns, columnName]);
    }
  };

  const toggleAll = (visible: boolean) => {
    onToggle(visible ? columns.map(c => c.name) : []);
  };

  const visibleCount = visibleColumns.length;
  const totalCount = columns.length;

  return (
    <div style={{ marginBottom: '16px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '12px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: '14px', fontWeight: 600 }}>
          👁️ Column Visibility ({visibleCount}/{totalCount})
        </span>
        <span style={{ fontSize: '12px', color: '#666' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '12px', paddingTop: 0, borderTop: '1px solid #ddd' }}>
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => toggleAll(true)}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Show All
            </button>
            <button
              onClick={() => toggleAll(false)}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Hide All
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
            {columns.map(column => (
              <label
                key={column.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  backgroundColor: 'white',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(column.name)}
                  onChange={() => toggleColumn(column.name)}
                  style={{ marginRight: '8px', cursor: 'pointer' }}
                />
                <span style={{ flex: 1 }}>{column.name}</span>
                <span style={{ fontSize: '11px', color: '#999', marginLeft: '4px' }}>
                  {column.column_type}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
