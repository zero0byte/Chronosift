import { useState, useMemo } from 'react';
import { Timeline, ColumnDefinition, TimelineEntry } from '../types';

interface FilterPanelProps {
  timeline: Timeline;
  entries?: TimelineEntry[];
  onApplyFilters: (filters: any) => void;
}

export default function FilterPanel({ timeline, entries = [], onApplyFilters }: FilterPanelProps) {
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Extract unique values for each column from entries
  const columnUniqueValues = useMemo(() => {
    const uniqueValues: Record<string, Set<any>> = {};
    
    entries.forEach(entry => {
      Object.entries(entry.data).forEach(([key, value]) => {
        if (!uniqueValues[key]) {
          uniqueValues[key] = new Set();
        }
        if (value !== null && value !== undefined && value !== '') {
          uniqueValues[key].add(String(value));
        }
      });
    });
    
    // Convert Sets to sorted arrays and limit to top 100 values per column
    const result: Record<string, string[]> = {};
    Object.entries(uniqueValues).forEach(([key, valueSet]) => {
      result[key] = Array.from(valueSet).sort().slice(0, 100);
    });
    
    return result;
  }, [entries]);

  const handleFilterChange = (columnName: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [columnName]: value
    }));
  };

  const handleApply = () => {
    // Remove empty filters and convert types
    const activeFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value && value !== '') {
        // Find the column to check its type
        const column = timeline.columns?.find(col => 
          col.name === key || 
          key.startsWith(col.name + '_')
        );
        
        // Convert number strings to actual numbers
        if (column?.column_type === 'number' && typeof value === 'string') {
          const numValue = Number(value);
          if (!isNaN(numValue)) {
            acc[key] = numValue;
          }
        } else {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, any>);
    
    onApplyFilters(activeFilters);
  };

  const handleClear = () => {
    setFilters({});
    onApplyFilters({});
  };

  const renderFilterInput = (column: ColumnDefinition) => {
    const value = filters[column.name] || '';

    switch (column.column_type) {
      case 'timestamp':
        return (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', color: '#666' }}>From:</label>
            <input
              type="date"
              value={filters[`${column.name}_from`] || ''}
              onChange={(e) => handleFilterChange(`${column.name}_from`, e.target.value)}
              style={{ padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', width: '120px' }}
            />
            <label style={{ fontSize: '11px', color: '#666' }}>To:</label>
            <input
              type="date"
              value={filters[`${column.name}_to`] || ''}
              onChange={(e) => handleFilterChange(`${column.name}_to`, e.target.value)}
              style={{ padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', width: '120px' }}
            />
          </div>
        );
      
      case 'number':
        // Event IDs and similar fields should be exact match, not ranges
        const isIdField = column.name.toLowerCase().includes('id') || 
                         column.name.toLowerCase().includes('event') ||
                         column.name.toLowerCase().includes('code');
        
        if (isIdField) {
          // Exact match for ID fields with autocomplete
          const uniqueVals = columnUniqueValues[column.name] || [];
          const datalistId = `datalist-${column.name.replace(/\s+/g, '-')}`;
          
          return (
            <>
              <input
                type="number"
                list={uniqueVals.length > 0 ? datalistId : undefined}
                placeholder={`Exact ${column.name}`}
                value={value}
                onChange={(e) => {
                  const numValue = e.target.value === '' ? '' : Number(e.target.value);
                  handleFilterChange(column.name, numValue);
                }}
                style={{ width: '100%', padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
              />
              {uniqueVals.length > 0 && (
                <datalist id={datalistId}>
                  {uniqueVals.map((val, idx) => (
                    <option key={idx} value={val} />
                  ))}
                </datalist>
              )}
            </>
          );
        }
        
        // Range for numeric fields like size, count, etc.
        return (
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <input
              type="number"
              placeholder="Min"
              value={filters[`${column.name}_min`] || ''}
              onChange={(e) => handleFilterChange(`${column.name}_min`, e.target.value)}
              style={{ padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', width: '80px' }}
            />
            <span style={{ fontSize: '12px' }}>-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters[`${column.name}_max`] || ''}
              onChange={(e) => handleFilterChange(`${column.name}_max`, e.target.value)}
              style={{ padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px', width: '80px' }}
            />
          </div>
        );
      
      case 'boolean':
        return (
          <select
            value={value}
            onChange={(e) => handleFilterChange(column.name, e.target.value)}
            style={{ padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );
      
      case 'tags':
        const tagsUniqueVals = columnUniqueValues[column.name] || [];
        const tagsDatalistId = `datalist-${column.name.replace(/\s+/g, '-')}`;
        
        return (
          <>
            <input
              type="text"
              list={tagsUniqueVals.length > 0 ? tagsDatalistId : undefined}
              placeholder="Contains tags (comma separated)"
              value={value}
              onChange={(e) => handleFilterChange(column.name, e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
            {tagsUniqueVals.length > 0 && (
              <datalist id={tagsDatalistId}>
                {tagsUniqueVals.map((val, idx) => (
                  <option key={idx} value={val} />
                ))}
              </datalist>
            )}
          </>
        );
      
      default:
        const defaultUniqueVals = columnUniqueValues[column.name] || [];
        const defaultDatalistId = `datalist-${column.name.replace(/\s+/g, '-')}`;
        
        return (
          <>
            <input
              type="text"
              list={defaultUniqueVals.length > 0 ? defaultDatalistId : undefined}
              placeholder={`Filter ${column.name}...`}
              value={value}
              onChange={(e) => handleFilterChange(column.name, e.target.value)}
              style={{ width: '100%', padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '3px' }}
            />
            {defaultUniqueVals.length > 0 && (
              <datalist id={defaultDatalistId}>
                {defaultUniqueVals.map((val, idx) => (
                  <option key={idx} value={val} />
                ))}
              </datalist>
            )}
          </>
        );
    }
  };

  const activeFilterCount = Object.values(filters).filter(v => v && v !== '').length;

  return (
    <div style={{ marginBottom: '15px' }}>
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          padding: '6px 12px',
          backgroundColor: activeFilterCount > 0 ? '#ffc107' : '#6c757d',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        🔍 Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
      </button>

      {showFilters && (
        <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#f8f9fa', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            {timeline.columns?.filter(col => col.is_searchable).map(column => (
              <div key={column.id}>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600 }}>
                  {column.name}
                </label>
                {renderFilterInput(column)}
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleApply}
              style={{ padding: '6px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Apply Filters
            </button>
            <button
              onClick={handleClear}
              style={{ padding: '6px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
