import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { Timeline, TimelineEntry, ColumnDefinition, LabelOption } from '../types';
import MitreTacticsSelect, { MITRE_TACTICS } from './MitreTacticsSelect';
import LabelSelect from './LabelSelect';
import { enrichmentAPI, timelineAPI } from '../lib/api';
import { PriorityBadge, MitreTechniqueBadge, ConfidenceIndicator } from './llm';
import EntryLinks from './EntryLinks';

interface TimelineTableProps {
  timeline: Timeline;
  entries: TimelineEntry[];
  visibleColumns?: string[];
  onCreateEntry: (data: any) => Promise<void>;
  onUpdateEntry: (entryId: number, data: any) => Promise<void>;
  onDeleteEntry: (entryId: number) => void;
  onPromoteEntries?: (entryIds: number[]) => Promise<void>;
  onEnrichEntry?: (entry: TimelineEntry) => void;
  onAnalyzeEntries?: (entryIds: number[]) => Promise<void>;
  onEntryClick?: (entryId: number) => void;
  highlightedEntryId?: number | null;
  onPivot?: (entry: TimelineEntry) => void;
  onCreateKeyTimestamp?: (entry: TimelineEntry) => void;
  projectId?: number;
  llmAvailable?: boolean;
  llmChecked?: boolean;
  llmMessage?: string;
}

// Helper function to validate IP addresses
const isValidIP = (ip: string): boolean => {
  // IPv4 validation
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // IPv6 validation (simplified)
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$|^::([0-9a-fA-F]{0,4}:){0,6}[0-9a-fA-F]{0,4}$|^([0-9a-fA-F]{0,4}:){1,7}:$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Fallback copy function for environments without clipboard API (HTTP contexts)
const fallbackCopyTextToClipboard = (text: string, element: HTMLElement) => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.width = '2em';
  textArea.style.height = '2em';
  textArea.style.padding = '0';
  textArea.style.border = 'none';
  textArea.style.outline = 'none';
  textArea.style.boxShadow = 'none';
  textArea.style.background = 'transparent';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  
  try {
    document.execCommand('copy');
    // Visual feedback on success
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#D1FAE5';
    setTimeout(() => {
      element.style.backgroundColor = originalBg;
    }, 200);
  } catch (err) {
    console.error('Fallback: Could not copy text', err);
    alert(`Copy failed. Entry ID is: ${text}`);
  }
  
  document.body.removeChild(textArea);
};

export default function TimelineTable({ timeline, entries, visibleColumns, onCreateEntry, onUpdateEntry, onDeleteEntry, onPromoteEntries, onEnrichEntry, onAnalyzeEntries, onEntryClick, highlightedEntryId, onPivot, onCreateKeyTimestamp, projectId, llmAvailable = true, llmChecked = true, llmMessage = '' }: TimelineTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: number; columnId: string } | null>(null);
  const [editValue, setEditValue] = useState<any>('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newEntry, setNewEntry] = useState<any>({});
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [modalEntry, setModalEntry] = useState<{ entry: TimelineEntry; sourceLink: string; sourceData?: any } | null>(null);
  const [loadingSourceData, setLoadingSourceData] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [enrichedEntries, setEnrichedEntries] = useState<Set<number>>(new Set());
  const [enrichmentData, setEnrichmentData] = useState<Record<number, any[]>>({});
  const highlightedRowRef = useRef<Record<number, HTMLTableRowElement | null>>({});
  const [linkEntryId, setLinkEntryId] = useState<number | null>(null);
  
  // Scroll to highlighted entry when it changes or entries update
  useEffect(() => {
    if (highlightedEntryId) {
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        const rowElement = highlightedRowRef.current[highlightedEntryId];
        if (rowElement) {
          rowElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      });
    }
  }, [highlightedEntryId, entries]);

  const toggleRowSelection = (rowId: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === entries.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(entries.map(e => e.id)));
    }
  };

  const toggleRowExpand = async (rowId: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
        // Load enrichment data when expanding
        loadEnrichmentData(rowId);
      }
      return newSet;
    });
  };
  
  const loadEnrichmentData = async (entryId: number) => {
    try {
      const response = await enrichmentAPI.getEntryEntities(entryId);
      if (response.data && response.data.length > 0) {
        setEnrichmentData(prev => ({ ...prev, [entryId]: response.data }));
        setEnrichedEntries(prev => new Set(prev).add(entryId));
      }
    } catch (error) {
      console.error('Failed to load enrichment data:', error);
    }
  };

  const loadSourceEventData = async (sourceLink: string) => {
    try {
      // Parse the source link to extract timeline ID and entry ID
      // Format: /timelines/{timeline_id}?entry={entry_id}
      const match = sourceLink.match(/\/timelines\/(\d+).*[?&]entry=(\d+)/);
      if (!match) {
        return null;
      }
      
      const [, sourceTimelineId, sourceEntryId] = match;
      const response = await timelineAPI.getEntry(Number(sourceTimelineId), Number(sourceEntryId));
      // API returns { data: { entry: {...} } }, so we need response.data.entry
      return response.data.entry || response.data;
    } catch (error) {
      console.error('Failed to load source event data:', error);
      return null;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) return;
    if (!window.confirm(`Delete ${selectedRows.size} selected entries?`)) return;
    
    try {
      for (const rowId of selectedRows) {
        await onDeleteEntry(rowId);
      }
      setSelectedRows(new Set());
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Some entries failed to delete');
    }
  };

  const handleCopyToClipboard = () => {
    if (selectedRows.size === 0) return;
    
    const selectedEntries = entries.filter(e => selectedRows.has(e.id));
    const columns = timeline.columns || [];
    
    // Create TSV (Tab-Separated Values) format
    const header = columns.map(col => col.name).join('\t');
    const rows = selectedEntries.map(entry => 
      columns.map(col => {
        const value = entry.data[col.name];
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return value.join('; ');
        return String(value);
      }).join('\t')
    );
    
    const text = [header, ...rows].join('\n');
    
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied ${selectedRows.size} entries to clipboard`);
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  };

  const handlePromote = async () => {
    if (selectedRows.size === 0 || !onPromoteEntries) return;
    
    try {
      await onPromoteEntries(Array.from(selectedRows));
      setSelectedRows(new Set());
      alert(`Promoted ${selectedRows.size} entries to Master Timeline`);
    } catch (error: any) {
      console.error('Promote failed:', error);
      alert(`Failed to promote entries: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleExportCSV = () => {
    const columns = timeline.columns || [];
    
    // Create CSV header
    const header = columns.map(col => `"${col.name}"`).join(',');
    
    // Create CSV rows
    const rows = entries.map(entry => 
      columns.map(col => {
        const value = entry.data[col.name];
        if (value === null || value === undefined) return '';
        
        // Handle different types
        if (Array.isArray(value)) {
          return `"${value.join('; ')}"`;
        }
        if (typeof value === 'object') {
          return `"${JSON.stringify(value)}"`;
        }
        
        // Escape quotes and wrap in quotes
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      }).join(',')
    );
    
    // Combine header and rows
    const csv = [header, ...rows].join('\n');
    
    // Create download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${timeline.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCellValue = (col: ColumnDefinition, value: any) => {
    if (value === null || value === undefined || value === '') {
      return <span style={{ color: '#ccc' }}>-</span>;
    }

    // Special handling for Link column
    if (col.name === 'Link' && typeof value === 'string' && value.startsWith('/timelines/')) {
      return value; // Just show the link text, clicking will be handled by row click
    }

    switch (col.column_type) {
      case 'timestamp':
        return new Date(value).toLocaleString();
      case 'tags':
        return Array.isArray(value) ? value.join(', ') : value;
      case 'multiselect':
        if (Array.isArray(value) && value.length > 0) {
          const options = col.config?.options || [];
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {value.map((val, idx) => {
                const option = options.find((opt: any) => opt.value === val);
                const label = option?.label || val;
                return (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '3px',
                      backgroundColor: '#e0e7ff',
                      color: '#3730a3',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      case 'boolean':
        return value ? '✓' : '✗';
      case 'number':
        // Don't format ID fields with commas (e.g., Event ID 4624 not 4,624)
        const isIdField = col.name.toLowerCase().includes('id') || 
                         col.name.toLowerCase().includes('event') ||
                         col.name.toLowerCase().includes('code');
        return isIdField ? value : value.toLocaleString();
      case 'mitre_tactics':
        if (Array.isArray(value) && value.length > 0) {
          const tactics = MITRE_TACTICS.filter(t => value.includes(t.id));
          return tactics.map(t => `${t.id}: ${t.name}`).join(', ');
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      case 'label':
        if (value && col.config?.options) {
          const option = col.config.options.find((opt: LabelOption) => opt.value === value);
          if (option) {
            // Calculate contrast color for text
            const getContrastColor = (hexColor: string): string => {
              const hex = hexColor.replace('#', '');
              const r = parseInt(hex.substr(0, 2), 16);
              const g = parseInt(hex.substr(2, 2), 16);
              const b = parseInt(hex.substr(4, 2), 16);
              const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
              return luminance > 0.5 ? '#000000' : '#FFFFFF';
            };
            return (
              <span
                style={{
                  display: 'inline-block',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  backgroundColor: option.color,
                  color: getContrastColor(option.color),
                  fontSize: '13px',
                  fontWeight: '500'
                }}
              >
                {option.label}
              </span>
            );
          }
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      case 'ip_address':
        return (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              padding: '2px 6px',
              backgroundColor: '#f0f0f0',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
            title="Click to enrich"
            onClick={(e) => {
              e.stopPropagation();
              if (onEnrichEntry) {
                const entry = entries.find(e => e.data[col.name] === value);
                if (entry) onEnrichEntry(entry);
              }
            }}
          >
            {value}
          </span>
        );
      case 'hash':
        const hashType = value.length === 32 ? 'MD5' : value.length === 40 ? 'SHA1' : value.length === 64 ? 'SHA256' : '';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hashType && (
              <span style={{ fontSize: '10px', color: '#666', fontWeight: 'bold' }}>{hashType}</span>
            )}
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                wordBreak: 'break-all',
                cursor: 'pointer'
              }}
              title="Click to copy"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(value);
              }}
            >
              {value}
            </span>
          </div>
        );
      case 'url':
        // Defang URLs for safety
        const defanged = String(value)
          .replace(/https?:\/\//gi, (match) => match.replace('://', '[://]'))
          .replace(/\./g, '[.]');
        return (
          <span
            style={{
              fontFamily: 'monospace',
              fontSize: '13px',
              color: '#0066cc',
              cursor: 'pointer',
              wordBreak: 'break-all'
            }}
            title={`Original: ${value}\nClick to copy original URL`}
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
            }}
          >
            {defanged}
          </span>
        );
      case 'duration':
        // Parse duration in seconds or as formatted string
        const formatDuration = (val: any): string => {
          if (typeof val === 'number') {
            const hours = Math.floor(val / 3600);
            const minutes = Math.floor((val % 3600) / 60);
            const seconds = Math.floor(val % 60);
            const parts = [];
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0) parts.push(`${minutes}m`);
            if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
            return parts.join(' ');
          }
          return String(val);
        };
        return (
          <span style={{ fontFamily: 'monospace', fontSize: '13px' }}>
            {formatDuration(value)}
          </span>
        );
      case 'json':
        try {
          const jsonValue = typeof value === 'string' ? JSON.parse(value) : value;
          const preview = JSON.stringify(jsonValue).substring(0, 50);
          return (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#666',
                cursor: 'pointer'
              }}
              title="Click to expand"
            >
              {preview}{JSON.stringify(jsonValue).length > 50 ? '...' : ''}
            </span>
          );
        } catch {
          return <span style={{ color: '#dc3545', fontSize: '12px' }}>Invalid JSON</span>;
        }
      default:
        return String(value);
    }
  };

  const renderEditCell = (col: ColumnDefinition, value: any, onChange: (val: any) => void) => {
    switch (col.column_type) {
      case 'timestamp':
        return (
          <input
            type="datetime-local"
            value={value ? new Date(value).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              const isoString = e.target.value ? new Date(e.target.value).toISOString() : '';
              onChange(isoString);
            }}
            style={{ width: '100%', padding: '4px' }}
            autoFocus
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => {
              const numValue = e.target.value === '' ? null : Number(e.target.value);
              onChange(numValue);
            }}
            style={{ width: '100%', padding: '4px' }}
            autoFocus
          />
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            autoFocus
          />
        );
      case 'tags':
        return (
          <input
            type="text"
            value={Array.isArray(value) ? value.join(', ') : value || ''}
            onChange={(e) => onChange(e.target.value.split(',').map(t => t.trim()))}
            placeholder="Comma-separated tags"
            style={{ width: '100%', padding: '4px' }}
            autoFocus
          />
        );
      case 'multiselect':
        const options = col.config?.options || [];
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', backgroundColor: '#fff', maxHeight: '200px', overflowY: 'auto' }}>
            {options.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#999', padding: '4px' }}>No options configured</div>
            ) : (
              options.map((opt: any) => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(opt.value)}
                    onChange={(e) => {
                      const newValues = e.target.checked
                        ? [...selectedValues, opt.value]
                        : selectedValues.filter((v: any) => v !== opt.value);
                      onChange(newValues);
                    }}
                    style={{ marginRight: '8px' }}
                  />
                  {opt.label}
                </label>
              ))
            )}
          </div>
        );
      case 'mitre_tactics':
        return (
          <MitreTacticsSelect
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
          />
        );
      case 'label':
        return (
          <LabelSelect
            value={value || null}
            options={col.config?.options || []}
            onChange={onChange}
          />
        );
      case 'ip_address':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 192.168.1.1 or 2001:db8::1"
            style={{ width: '100%', padding: '4px', fontFamily: 'monospace' }}
            autoFocus
            onBlur={(e) => {
              // Basic IPv4/IPv6 validation
              const val = e.target.value.trim();
              if (val && !isValidIP(val)) {
                alert('Invalid IP address format');
              }
            }}
          />
        );
      case 'hash':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            placeholder="MD5 (32), SHA1 (40), or SHA256 (64) characters"
            style={{ width: '100%', padding: '4px', fontFamily: 'monospace', fontSize: '12px' }}
            autoFocus
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && ![32, 40, 64].includes(val.length)) {
                alert('Hash should be 32 (MD5), 40 (SHA1), or 64 (SHA256) characters');
              }
            }}
          />
        );
      case 'url':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com"
            style={{ width: '100%', padding: '4px', fontFamily: 'monospace' }}
            autoFocus
          />
        );
      case 'duration':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => {
              const val = e.target.value;
              // Try to parse as duration format (e.g., "2h 30m 15s") or seconds
              if (/^\d+$/.test(val)) {
                onChange(parseInt(val));
              } else {
                onChange(val);
              }
            }}
            placeholder="e.g. 3600 (seconds) or 1h 30m"
            style={{ width: '100%', padding: '4px', fontFamily: 'monospace' }}
            autoFocus
          />
        );
      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Keep as string while typing
                onChange(e.target.value);
              }
            }}
            placeholder='{"key": "value"}'
            style={{ 
              width: '100%', 
              padding: '4px',
              minHeight: '80px',
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.currentTarget.blur();
              }
            }}
          />
        );
      default:
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '4px',
              minHeight: '60px',
              resize: 'vertical',
              fontFamily: 'inherit',
              fontSize: 'inherit'
            }}
            autoFocus
            onKeyDown={(e) => {
              // Allow Enter key for new lines, but Escape to cancel
              if (e.key === 'Escape') {
                e.currentTarget.blur();
              }
            }}
          />
        );
    }
  };

  // Initialize column order
  useMemo(() => {
    if (timeline.columns && columnOrder.length === 0) {
      setColumnOrder(timeline.columns.map(c => c.name));
    }
  }, [timeline.columns]);

  // Get ordered and visible columns
  const orderedColumns = useMemo(() => {
    if (!timeline.columns || columnOrder.length === 0) return timeline.columns || [];
    
    let cols = columnOrder
      .map(name => timeline.columns!.find(col => col.name === name))
      .filter((col): col is ColumnDefinition => col !== undefined);
    
    // Filter by visibility if visibleColumns is provided
    if (visibleColumns && visibleColumns.length > 0) {
      cols = cols.filter(col => visibleColumns.includes(col.name));
    }
    
    return cols;
  }, [timeline.columns, columnOrder, visibleColumns]);

  // Build columns from timeline column definitions - memoized to prevent infinite renders
  const columns: ColumnDef<TimelineEntry>[] = useMemo(() => [
    {
      id: 'expand',
      header: '',
      cell: ({ row }: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => toggleRowExpand(row.original.id)}
            style={{ cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '16px', padding: '4px' }}
            title="Toggle raw data"
          >
            {expandedRows.has(row.original.id) ? '▼' : '▶'}
          </button>
          {enrichedEntries.has(row.original.id) && (
            <span style={{ fontSize: '14px', cursor: 'help' }} title="This entry has enrichment data">
              ✨
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={selectedRows.size === entries.length && entries.length > 0}
          onChange={toggleSelectAll}
          style={{ cursor: 'pointer' }}
        />
      ),
      cell: ({ row }: any) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.original.id)}
          onChange={() => toggleRowSelection(row.original.id)}
          style={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      id: 'id',
      header: 'ID',
      accessorFn: (row: TimelineEntry) => row.id,
      cell: ({ row }: any) => (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#6B7280',
            padding: '4px',
            cursor: 'pointer',
            userSelect: 'all'
          }}
          onClick={(e) => {
            e.stopPropagation();
            const id = String(row.original.id);
            
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(id).then(() => {
                // Visual feedback on success
                const target = e.currentTarget;
                const originalBg = target.style.backgroundColor;
                target.style.backgroundColor = '#D1FAE5';
                setTimeout(() => {
                  target.style.backgroundColor = originalBg;
                }, 200);
              }).catch(() => {
                // Fallback if clipboard API fails
                fallbackCopyTextToClipboard(id, e.currentTarget);
              });
            } else {
              // Use fallback for insecure contexts (HTTP)
              fallbackCopyTextToClipboard(id, e.currentTarget);
            }
          }}
          title="Click to copy entry ID"
        >
          {row.original.id}
        </div>
      ),
    },
    {
      id: 'llm_analysis',
      header: 'LLM Analysis',
      accessorFn: (row: TimelineEntry) => row.analysis,
      cell: ({ row }: any) => {
        const analysis = row.original.analysis;
        if (!analysis) return null;
        
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px' }}>
            {analysis.priority_score !== undefined && (
              <div>
                <PriorityBadge score={analysis.priority_score} size="sm" />
              </div>
            )}
            {analysis.mitre_technique && (
              <div>
                <MitreTechniqueBadge 
                  technique={{
                    technique_id: analysis.mitre_technique.id,
                    name: analysis.mitre_technique.name
                  }}
                  size="sm"
                />
              </div>
            )}
            {analysis.confidence_score !== undefined && (
              <div>
                <ConfidenceIndicator confidence={analysis.confidence_score} size="sm" showLabel={false} />
              </div>
            )}
          </div>
        );
      },
    },
    ...(orderedColumns.map((col: ColumnDefinition) => ({
      id: col.name,
      accessorFn: (row: TimelineEntry) => row.data[col.name],
      header: col.name + (col.is_required ? ' *' : ''),
      cell: ({ row, getValue }: any) => {
        const isEditing = editingCell?.rowId === row.original.id && editingCell?.columnId === col.name;
        const value = getValue();

        if (isEditing) {
          return renderEditCell(col, editValue, setEditValue);
        }

        // Handle Link column click
        if (col.name === 'Link' && typeof value === 'string' && value.startsWith('/timelines/')) {
          return (
            <div
              onClick={async (e) => {
                e.stopPropagation();
                setModalEntry({ entry: row.original, sourceLink: value });
                setLoadingSourceData(true);
                const sourceData = await loadSourceEventData(value);
                setModalEntry({ entry: row.original, sourceLink: value, sourceData });
                setLoadingSourceData(false);
              }}
              style={{ cursor: 'pointer', minHeight: '20px', padding: '4px', color: '#007bff', textDecoration: 'underline' }}
            >
              View Source
            </div>
          );
        }

        return (
          <div
            onClick={() => startEdit(row.original.id, col.name, value)}
            style={{ cursor: 'pointer', minHeight: '20px', padding: '4px' }}
          >
            {renderCellValue(col, value)}
          </div>
        );
      },
    })) || []),
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }: any) => (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {editingCell?.rowId === row.original.id && (
            <>
              <button onClick={() => saveEdit(row.original.id)} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Save</button>
              <button onClick={cancelEdit} style={{ padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
            </>
          )}
          {onEntryClick && (
            <button 
              onClick={() => onEntryClick(row.original.id)} 
              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              title="View and add comments"
            >
              💬 Comments
            </button>
          )}
          {onEnrichEntry && (
            <button 
              onClick={() => onEnrichEntry(row.original)} 
              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#9333ea', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              title="Extract and enrich entities from this entry"
            >
              ✨ Enrich
            </button>
          )}
          {onCreateKeyTimestamp && (
            <button 
              onClick={() => onCreateKeyTimestamp(row.original)} 
              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#E94B8B', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              title="Create key timestamp from this entry"
            >
              🔖 Key
            </button>
          )}
          {projectId && (
            <button 
              onClick={() => setLinkEntryId(row.original.id)} 
              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              title="Link this entry to other entries"
            >
              🔗 Link
            </button>
          )}
          <button onClick={() => onDeleteEntry(row.original.id)} style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Delete</button>
        </div>
      ),
    },
  ], [orderedColumns, editingCell, editValue, selectedRows, entries, expandedRows]);

  const table = useReactTable({
    data: entries, // Note: This receives displayEntries from parent via the entries prop
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const startEdit = (rowId: number, columnId: string, value: any) => {
    setEditingCell({ rowId, columnId });
    setEditValue(value || '');
  };

  const saveEdit = async (rowId: number) => {
    const entry = entries.find(e => e.id === rowId);
    if (!entry || !editingCell) return;

    const updatedData = { ...entry.data, [editingCell.columnId]: editValue };
    
    try {
      await onUpdateEntry(rowId, updatedData);
      setEditingCell(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    const requiredColumns = timeline.columns?.filter(col => col.is_required) || [];
    const missingFields = requiredColumns.filter(col => !newEntry[col.name] && newEntry[col.name] !== 0);
    
    if (missingFields.length > 0) {
      alert(`Please fill in required fields: ${missingFields.map(col => col.name).join(', ')}`);
      return;
    }
    
    try {
      await onCreateEntry(newEntry);
      setNewEntry({});
      setShowAddRow(false);
    } catch (error: any) {
      console.error('Failed to create entry:', error);
      alert(`Failed to create entry: ${error.response?.data?.error || error.message}`);
    }
  };

  // Check if timeline has columns
  if (!timeline.columns || timeline.columns.length === 0) {
    return (
      <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
        <h3>No Columns Defined</h3>
        <p style={{ color: '#666' }}>This timeline doesn't have any columns defined. Please create a new timeline with default columns or add columns to this timeline.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ padding: '15px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h3 style={{ margin: 0 }}>Timeline Entries</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedRows.size > 0 && (
            <>
              <span style={{ fontSize: '14px', color: '#666' }}>{selectedRows.size} selected</span>
              {onPivot && selectedRows.size === 1 && (
                <button
                  onClick={() => {
                    const selectedEntry = entries.find(e => selectedRows.has(e.id));
                    if (selectedEntry) onPivot(selectedEntry);
                  }}
                  style={{ padding: '6px 12px', backgroundColor: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                  title="Show events around this entry's timestamp"
                >
                  ⏱️ Pivot
                </button>
              )}
              <button
                onClick={handleCopyToClipboard}
                style={{ padding: '6px 12px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                📋 Copy
              </button>
              {onAnalyzeEntries && (
                <button
                  onClick={async () => {
                    if (!llmAvailable) {
                      alert(`LLM Analysis Not Available\n\n${llmMessage}\n\nPlease configure an LLM provider in backend/.env:\n- For OpenAI: Set OPENAI_API_KEY\n- For local: Set LOCAL_LLM_BASE_URL and ensure Ollama/LM Studio is running\n\nThen restart: docker-compose restart backend celery_worker`);
                      return;
                    }
                    if (selectedRows.size > 0) {
                      await onAnalyzeEntries(Array.from(selectedRows));
                      setSelectedRows(new Set());
                    }
                  }}
                  disabled={!llmChecked}
                  style={{ 
                    padding: '6px 12px', 
                    backgroundColor: (llmAvailable && llmChecked) ? '#9333ea' : '#ccc', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: (llmAvailable && llmChecked) ? 'pointer' : 'not-allowed', 
                    fontSize: '14px', 
                    fontWeight: '500',
                    opacity: !llmAvailable && llmChecked ? 0.6 : 1
                  }}
                  title={!llmChecked ? 'Checking LLM availability...' : (!llmAvailable ? `LLM not available: ${llmMessage}` : "Analyze selected entries with LLM")}
                >
                  {!llmChecked ? '⏳' : '🧠'} Analyze
                </button>
              )}
              {onPromoteEntries && !timeline.is_master && (
                <button
                  onClick={handlePromote}
                  style={{ padding: '6px 12px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  ⭐ Promote
                </button>
              )}
              <button
                onClick={handleBulkDelete}
                style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
              >
                🗑️ Delete
              </button>
            </>
          )}
          <button
            onClick={handleExportCSV}
            style={{ padding: '8px 16px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="Export all entries as CSV"
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => setShowAddRow(!showAddRow)}
            style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            + Add Entry
          </button>
        </div>
      </div>

      {showAddRow && (
        <form onSubmit={handleAddEntry} style={{ padding: '15px', borderBottom: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            {timeline.columns?.map((col: ColumnDefinition) => (
              <div key={col.id}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                  {col.name} {col.is_required && <span style={{ color: 'red' }}>*</span>}
                </label>
                {renderEditCell(col, newEntry[col.name], (val) => setNewEntry({ ...newEntry, [col.name]: val }))}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
            <button type="button" onClick={() => { setShowAddRow(false); setNewEntry({}); }} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                {headerGroup.headers.map((header, idx) => {
                  const columnId = header.id;
                  const width = columnWidths[columnId] || 150;
                  const isDragging = draggedColumn === columnId;
                  
                  return (
                    <th 
                      key={header.id} 
                      draggable={idx > 1} // Don't allow dragging expand and select columns
                      onDragStart={(e) => {
                        if (idx > 1) {
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedColumn(columnId);
                        }
                      }}
                      onDragOver={(e) => {
                        if (idx > 1 && draggedColumn && draggedColumn !== columnId) {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                        }
                      }}
                      onDrop={(e) => {
                        if (idx > 1 && draggedColumn && draggedColumn !== columnId) {
                          e.preventDefault();
                          
                          // Reorder columns
                          const newOrder = [...columnOrder];
                          const dragIndex = newOrder.indexOf(draggedColumn);
                          const dropIndex = newOrder.indexOf(columnId);
                          
                          if (dragIndex !== -1 && dropIndex !== -1) {
                            const [removed] = newOrder.splice(dragIndex, 1);
                            newOrder.splice(dropIndex, 0, removed);
                            setColumnOrder(newOrder);
                          }
                        }
                        setDraggedColumn(null);
                      }}
                      onDragEnd={() => setDraggedColumn(null)}
                      style={{ 
                        padding: '12px', 
                        textAlign: 'left', 
                        fontWeight: 600, 
                        fontSize: '14px',
                        width: `${width}px`,
                        minWidth: `${width}px`,
                        position: 'relative',
                        cursor: idx > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        opacity: isDragging ? 0.5 : 1,
                        userSelect: 'none',
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      
                      {/* Resize handle */}
                      {idx > 1 && (
                        <div
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setIsResizing(columnId);
                            const startX = e.clientX;
                            const startWidth = width;
                            
                            const handleMouseMove = (moveEvent: MouseEvent) => {
                              const delta = moveEvent.clientX - startX;
                              const newWidth = Math.max(50, startWidth + delta);
                              setColumnWidths(prev => ({ ...prev, [columnId]: newWidth }));
                            };
                            
                            const handleMouseUp = () => {
                              setIsResizing(null);
                              document.removeEventListener('mousemove', handleMouseMove);
                              document.removeEventListener('mouseup', handleMouseUp);
                            };
                            
                            document.addEventListener('mousemove', handleMouseMove);
                            document.addEventListener('mouseup', handleMouseUp);
                          }}
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 0,
                            bottom: 0,
                            width: '8px',
                            cursor: 'col-resize',
                            backgroundColor: isResizing === columnId ? '#007bff' : 'transparent',
                            zIndex: 10,
                          }}
                          onMouseEnter={(e) => {
                            if (!isResizing) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = '#007bff';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (isResizing !== columnId) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            }
                          }}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No entries found
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => {
                const isHighlighted = highlightedEntryId === row.original.id;
                return (
                <>
                  <tr 
                    key={row.id} 
                    ref={el => {
                      if (isHighlighted) {
                        highlightedRowRef.current[row.original.id] = el;
                      }
                    }}
                    style={{ 
                      borderBottom: '1px solid #eee',
                      backgroundColor: isHighlighted ? '#fff3cd' : 'transparent',
                      transition: 'background-color 0.3s ease',
                      boxShadow: isHighlighted ? '0 0 8px rgba(255, 193, 7, 0.5)' : 'none'
                    }}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} style={{ padding: '8px', fontSize: '14px' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                  {expandedRows.has(row.original.id) && (
                    <tr key={`${row.id}-expanded`} style={{ backgroundColor: '#f8f9fa' }}>
                      <td colSpan={columns.length} style={{ padding: '20px' }}>
                        <div style={{ marginLeft: '40px', marginRight: '40px' }}>
                          {/* Enrichment Data Section */}
                          {enrichmentData[row.original.id] && enrichmentData[row.original.id].length > 0 && (
                            <div style={{ marginBottom: '20px' }}>
                              <strong style={{ fontSize: '14px', marginBottom: '10px', display: 'block', color: '#333' }}>✨ Enrichment Data:</strong>
                              {enrichmentData[row.original.id].map((entity: any, idx: number) => (
                                <div key={idx} style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#495057', marginBottom: '8px' }}>
                                    <span style={{ backgroundColor: '#e3f2fd', padding: '2px 6px', borderRadius: '3px', marginRight: '8px', fontFamily: 'monospace' }}>{entity.entity_type}</span>
                                    <code style={{ color: '#2e7d32' }}>{entity.value}</code>
                                  </div>
                                  {entity.enrichments && entity.enrichments.length > 0 && (
                                    <div style={{ fontSize: '12px' }}>
                                      {entity.enrichments.map((enrich: any, eidx: number) => (
                                        <div key={eidx} style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '3px' }}>
                                          <div style={{ fontWeight: 600, color: '#333', marginBottom: '4px' }}>
                                            {enrich.provider_name} <span style={{ color: '#1976d2', fontSize: '11px' }}>({(enrich.confidence * 100).toFixed(0)}% confidence)</span>
                                          </div>
                                          {enrich.error ? (
                                            <div style={{ color: '#d32f2f', fontSize: '11px' }}>{enrich.error}</div>
                                          ) : (
                                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '11px', color: '#666', maxHeight: '150px', overflow: 'auto' }}>
                                              {JSON.stringify(enrich.data, null, 2)}
                                            </pre>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* Original Fields */}
                          <strong style={{ fontSize: '14px', marginBottom: '10px', display: 'block', color: '#333' }}>All Fields from Original Source:</strong>
                          <table style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #ddd', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#e9ecef' }}>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 600, width: '30%' }}>Field</th>
                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 600 }}>Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Object.entries(row.original.data)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([field, value]) => (
                                <tr key={field} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '8px 10px', fontWeight: 500, color: '#495057', verticalAlign: 'top' }}>{field}</td>
                                  <td style={{ padding: '8px 10px', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '12px' }}>
                                    {value === null || value === undefined ? (
                                      <span style={{ color: '#999', fontStyle: 'italic' }}>null</span>
                                    ) : typeof value === 'object' ? (
                                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>
                                    ) : (
                                      String(value)
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )})
            )}
          </tbody>
        </table>
      </div>

      {/* Event Detail Modal */}
      {modalEntry && createPortal(
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
          onClick={() => setModalEntry(null)}
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
                  Event Details
                </h3>
                <div style={{ fontSize: '13px', color: '#666' }}>
                  Source: <a href={modalEntry.sourceLink} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff' }}>{modalEntry.sourceLink}</a>
                </div>
              </div>
              <button
                onClick={() => setModalEntry(null)}
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
              {loadingSourceData ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <div style={{ fontSize: '16px', marginBottom: '10px' }}>Loading source event data...</div>
                  <div style={{ fontSize: '24px' }}>⏳</div>
                </div>
              ) : modalEntry.sourceData && modalEntry.sourceData.data ? (
                <>
                  <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px', borderLeft: '4px solid #007bff' }}>
                    <strong style={{ fontSize: '14px', color: '#333' }}>All Fields from Original Source:</strong>
                  </div>
                  <table style={{ width: '100%', backgroundColor: '#fff', border: '1px solid #ddd', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#e9ecef' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 600, width: '30%' }}>Field</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 600 }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(modalEntry.sourceData.data)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([field, value]) => (
                        <tr key={field} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 500, color: '#495057', verticalAlign: 'top' }}>{field}</td>
                          <td style={{ padding: '8px 10px', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: '12px' }}>
                            {value === null || value === undefined ? (
                              <span style={{ color: '#999', fontStyle: 'italic' }}>null</span>
                            ) : typeof value === 'object' ? (
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
                  <div style={{ fontSize: '16px', marginBottom: '10px' }}>Failed to load source event data</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>The original event may have been deleted or you may not have access to it.</div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {/* Entry Links Modal */}
      {linkEntryId && projectId && (
        <EntryLinks
          entryId={linkEntryId}
          projectId={projectId}
          currentTimelineId={timeline.id}
          onClose={() => setLinkEntryId(null)}
        />
      )}
    </div>
  );
}
