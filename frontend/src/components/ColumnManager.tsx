import { useState } from 'react';
import { timelineAPI } from '../lib/api';
import { Timeline, ColumnDefinition } from '../types';

interface ColumnManagerProps {
  timeline: Timeline;
  onUpdate: () => void;
}

const COLUMN_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'timestamp', label: 'Timestamp' },
  { value: 'number', label: 'Number' },
  { value: 'tags', label: 'Tags' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'label', label: 'Label (with colors)' },
  { value: 'ip_address', label: 'IP Address' },
  { value: 'hash', label: 'Hash (MD5/SHA1/SHA256)' },
  { value: 'url', label: 'URL/Domain' },
  { value: 'duration', label: 'Duration' },
  { value: 'json', label: 'JSON/Object' },
  { value: 'mitre_tactics', label: 'MITRE ATT&CK Tactics' },
];

// Predefined label templates
const LABEL_TEMPLATES = {
  status: [
    { value: 'open', label: 'Open', color: '#3b82f6' },
    { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
    { value: 'closed', label: 'Closed', color: '#10b981' },
  ],
  priority: [
    { value: 'low', label: 'Low', color: '#10b981' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#ef4444' },
    { value: 'critical', label: 'Critical', color: '#991b1b' },
  ],
  classification: [
    { value: 'benign', label: 'Benign', color: '#10b981' },
    { value: 'suspicious', label: 'Suspicious', color: '#f59e0b' },
    { value: 'malicious', label: 'Malicious', color: '#ef4444' },
  ],
  custom: [],
};

const MITRE_TACTICS = [
  { id: 'TA0043', name: 'Reconnaissance', description: 'The adversary is trying to gather information they can use to plan future operations.' },
  { id: 'TA0042', name: 'Resource Development', description: 'The adversary is trying to establish resources they can use to support operations.' },
  { id: 'TA0001', name: 'Initial Access', description: 'The adversary is trying to get into your network.' },
  { id: 'TA0002', name: 'Execution', description: 'The adversary is trying to run malicious code.' },
  { id: 'TA0003', name: 'Persistence', description: 'The adversary is trying to maintain their foothold.' },
  { id: 'TA0004', name: 'Privilege Escalation', description: 'The adversary is trying to gain higher-level permissions.' },
  { id: 'TA0005', name: 'Defense Evasion', description: 'The adversary is trying to avoid being detected.' },
  { id: 'TA0006', name: 'Credential Access', description: 'The adversary is trying to steal account names and passwords.' },
  { id: 'TA0007', name: 'Discovery', description: 'The adversary is trying to figure out your environment.' },
  { id: 'TA0008', name: 'Lateral Movement', description: 'The adversary is trying to move through your environment.' },
  { id: 'TA0009', name: 'Collection', description: 'The adversary is trying to gather data of interest to their goal.' },
  { id: 'TA0011', name: 'Command and Control', description: 'The adversary is trying to communicate with compromised systems to control them.' },
  { id: 'TA0010', name: 'Exfiltration', description: 'The adversary is trying to steal data.' },
  { id: 'TA0040', name: 'Impact', description: 'The adversary is trying to manipulate, interrupt, or destroy your systems and data.' },
];

export default function ColumnManager({ timeline, onUpdate }: ColumnManagerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newColumn, setNewColumn] = useState({
    name: '',
    column_type: 'text',
    is_required: false,
    is_searchable: true,
    config: {},
  });
  const [labelTemplate, setLabelTemplate] = useState<string>('status');
  const [labelOptions, setLabelOptions] = useState(LABEL_TEMPLATES.status);
  const [newLabelOption, setNewLabelOption] = useState({ value: '', label: '', color: '#3b82f6' });
  const [multiselectOptions, setMultiselectOptions] = useState<{ value: string; label: string }[]>([]);
  const [newMultiselectOption, setNewMultiselectOption] = useState({ value: '', label: '' });
  // const [editingColumn, setEditingColumn] = useState<ColumnDefinition | null>(null);

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Add label options to config if label column type
      const columnData = { ...newColumn } as any;
      if (newColumn.column_type === 'label') {
        if (labelOptions.length === 0) {
          alert('Please add at least one label option');
          return;
        }
        columnData.config = { options: labelOptions };
      } else if (newColumn.column_type === 'multiselect') {
        if (multiselectOptions.length === 0) {
          alert('Please add at least one multiselect option');
          return;
        }
        columnData.config = { options: multiselectOptions };
      }
      
      await timelineAPI.addColumn(timeline.id, columnData);
      setNewColumn({ name: '', column_type: 'text', is_required: false, is_searchable: true, config: {} });
      setLabelTemplate('status');
      setLabelOptions(LABEL_TEMPLATES.status);
      setNewLabelOption({ value: '', label: '', color: '#3b82f6' });
      setMultiselectOptions([]);
      setNewMultiselectOption({ value: '', label: '' });
      setShowAdd(false);
      onUpdate();
    } catch (error) {
      console.error('Failed to add column:', error);
      alert('Failed to add column');
    }
  };

  const handleDeleteColumn = async (columnId: number) => {
    if (!window.confirm('Are you sure you want to delete this column? This will remove all data in this column from existing entries.')) {
      return;
    }
    try {
      await timelineAPI.deleteColumn(timeline.id, columnId);
      onUpdate();
    } catch (error) {
      console.error('Failed to delete column:', error);
      alert('Failed to delete column');
    }
  };

  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '20px' }}>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          padding: '15px', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: expanded ? '1px solid #ddd' : 'none'
        }}
      >
        <h3 style={{ margin: 0 }}>Columns ({timeline.columns?.length || 0})</h3>
        <span style={{ fontSize: '20px' }}>{expanded ? '▼' : '▶'}</span>
      </div>
      
      {expanded && (
        <div style={{ padding: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowAdd(!showAdd); }}
              style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            >
              + Add Column
            </button>
          </div>

      {showAdd && (
        <form onSubmit={handleAddColumn} style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                Column Name *
              </label>
              <input
                type="text"
                value={newColumn.name}
                onChange={(e) => setNewColumn({ ...newColumn, name: e.target.value })}
                required
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '3px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                Type
              </label>
              <select
                value={newColumn.column_type}
                onChange={(e) => {
                  setNewColumn({ ...newColumn, column_type: e.target.value });
                  // Reset label options when switching to label type
                  if (e.target.value === 'label') {
                    setLabelOptions(LABEL_TEMPLATES.status);
                  } else if (e.target.value === 'multiselect') {
                    setMultiselectOptions([]);
                  }
                }}
                style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '3px' }}
              >
                {COLUMN_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Multiselect configuration */}
          {newColumn.column_type === 'multiselect' && (
            <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                Multiselect Options
              </label>
              
              <div style={{ marginBottom: '10px' }}>
                {multiselectOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        fontSize: '12px',
                        fontWeight: '500',
                        minWidth: '100px',
                        textAlign: 'center'
                      }}
                    >
                      {opt.label}
                    </span>
                    <code style={{ fontSize: '11px', color: '#666' }}>{opt.value}</code>
                    <button
                      type="button"
                      onClick={() => setMultiselectOptions(multiselectOptions.filter((_, i) => i !== idx))}
                      style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '3px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Add Option</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Value</label>
                    <input
                      type="text"
                      value={newMultiselectOption.value}
                      onChange={(e) => setNewMultiselectOption({ ...newMultiselectOption, value: e.target.value })}
                      placeholder="e.g. option1"
                      style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Label</label>
                    <input
                      type="text"
                      value={newMultiselectOption.label}
                      onChange={(e) => setNewMultiselectOption({ ...newMultiselectOption, label: e.target.value })}
                      placeholder="e.g. Option 1"
                      style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMultiselectOption.value || !newMultiselectOption.label) {
                        alert('Please fill in both value and label');
                        return;
                      }
                      setMultiselectOptions([...multiselectOptions, newMultiselectOption]);
                      setNewMultiselectOption({ value: '', label: '' });
                    }}
                    style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Label configuration */}
          {newColumn.column_type === 'label' && (
            <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                Label Options
              </label>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px' }}>Template</label>
                <select
                  value={labelTemplate}
                  onChange={(e) => {
                    setLabelTemplate(e.target.value);
                    setLabelOptions(LABEL_TEMPLATES[e.target.value as keyof typeof LABEL_TEMPLATES]);
                  }}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '13px' }}
                >
                  <option value="status">Status (Open, In Progress, Closed)</option>
                  <option value="priority">Priority (Low, Medium, High, Critical)</option>
                  <option value="classification">Classification (Benign, Suspicious, Malicious)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              
              <div style={{ marginBottom: '10px' }}>
                {labelOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        backgroundColor: opt.color,
                        color: '#fff',
                        fontSize: '12px',
                        fontWeight: '500',
                        minWidth: '100px',
                        textAlign: 'center'
                      }}
                    >
                      {opt.label}
                    </span>
                    <code style={{ fontSize: '11px', color: '#666' }}>{opt.value}</code>
                    <button
                      type="button"
                      onClick={() => setLabelOptions(labelOptions.filter((_, i) => i !== idx))}
                      style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '11px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '3px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Add Option</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 100px auto', gap: '6px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Value</label>
                    <input
                      type="text"
                      value={newLabelOption.value}
                      onChange={(e) => setNewLabelOption({ ...newLabelOption, value: e.target.value })}
                      placeholder="e.g. open"
                      style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Label</label>
                    <input
                      type="text"
                      value={newLabelOption.label}
                      onChange={(e) => setNewLabelOption({ ...newLabelOption, label: e.target.value })}
                      placeholder="e.g. Open"
                      style={{ width: '100%', padding: '4px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '2px', fontSize: '11px' }}>Color</label>
                    <input
                      type="color"
                      value={newLabelOption.color}
                      onChange={(e) => setNewLabelOption({ ...newLabelOption, color: e.target.value })}
                      style={{ width: '100%', height: '28px', padding: '2px', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newLabelOption.value || !newLabelOption.label) {
                        alert('Please fill in both value and label');
                        return;
                      }
                      setLabelOptions([...labelOptions, newLabelOption]);
                      setNewLabelOption({ value: '', label: '', color: '#3b82f6' });
                    }}
                    style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={newColumn.is_required}
                onChange={(e) => setNewColumn({ ...newColumn, is_required: e.target.checked })}
              />
              Required
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px' }}>
              <input
                type="checkbox"
                checked={newColumn.is_searchable}
                onChange={(e) => setNewColumn({ ...newColumn, is_searchable: e.target.checked })}
              />
              Searchable
            </label>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Add
            </button>
            <button type="button" onClick={() => setShowAdd(false)} style={{ padding: '6px 12px', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {timeline.columns?.map((column: ColumnDefinition) => (
          <div
            key={column.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px',
              border: '1px solid #e0e0e0',
              borderRadius: '4px',
              backgroundColor: '#fafafa'
            }}
          >
            <div>
              <strong>{column.name}</strong>
              <span style={{ marginLeft: '10px', color: '#666', fontSize: '13px' }}>
                {column.column_type}
              </span>
              {column.is_required && (
                <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#ffc107', padding: '2px 6px', borderRadius: '3px' }}>
                  Required
                </span>
              )}
              {column.is_searchable && (
                <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#17a2b8', color: '#fff', padding: '2px 6px', borderRadius: '3px' }}>
                  Searchable
                </span>
              )}
            </div>
            <button
              onClick={() => handleDeleteColumn(column.id)}
              style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
        </div>
      )}
    </div>
  );
}
