import { useState } from 'react';
import { Timeline, ColumnDefinition } from '../types';

interface FieldFilter {
  id: string;
  field: string;
  operator: string;
  value: any;
}

interface EnrichmentFilters {
  has_enrichment: boolean;
  providers?: string[];
  min_confidence?: number;
  entity_types?: string[];
}

interface QueryConfig {
  search_text?: string;
  field_filters: FieldFilter[];
  enrichment_filters?: EnrichmentFilters;
  logic: 'AND' | 'OR';
}

interface AdvancedFilterPanelProps {
  timeline: Timeline;
  onApplyFilters: (queryConfig: QueryConfig) => void;
  onSaveQuery?: (queryConfig: QueryConfig) => void;
  initialQuery?: QueryConfig;
}

const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Not Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'between', label: 'Between' },
  { value: 'in_list', label: 'In List' },
];

const ENRICHMENT_PROVIDERS = ['greynoise', 'abuseipdb', 'virustotal', 'ipinfo', 'shodan', 'alienvault'];
const ENTITY_TYPES = ['ip', 'domain', 'url', 'email', 'hash', 'cve'];

export default function AdvancedFilterPanel({ timeline, onApplyFilters, onSaveQuery, initialQuery }: AdvancedFilterPanelProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState(initialQuery?.search_text || '');
  const [fieldFilters, setFieldFilters] = useState<FieldFilter[]>(initialQuery?.field_filters || []);
  const [logic, setLogic] = useState<'AND' | 'OR'>(initialQuery?.logic || 'AND');
  
  // Enrichment filters
  const [enableEnrichmentFilter, setEnableEnrichmentFilter] = useState(initialQuery?.enrichment_filters?.has_enrichment || false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(initialQuery?.enrichment_filters?.providers || []);
  const [minConfidence, setMinConfidence] = useState(initialQuery?.enrichment_filters?.min_confidence || 0.7);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>(initialQuery?.enrichment_filters?.entity_types || []);

  const addFieldFilter = () => {
    const newFilter: FieldFilter = {
      id: `filter_${Date.now()}`,
      field: timeline.columns?.[0]?.name || '',
      operator: 'equals',
      value: ''
    };
    setFieldFilters([...fieldFilters, newFilter]);
  };

  const removeFieldFilter = (id: string) => {
    setFieldFilters(fieldFilters.filter(f => f.id !== id));
  };

  const updateFieldFilter = (id: string, updates: Partial<FieldFilter>) => {
    setFieldFilters(fieldFilters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const buildQueryConfig = (): QueryConfig => {
    const config: QueryConfig = {
      field_filters: fieldFilters.filter(f => f.value !== '' && f.value !== null),
      logic
    };

    if (searchText) {
      config.search_text = searchText;
    }

    if (enableEnrichmentFilter) {
      config.enrichment_filters = {
        has_enrichment: true,
        ...(selectedProviders.length > 0 && { providers: selectedProviders }),
        ...(minConfidence > 0 && { min_confidence: minConfidence }),
        ...(selectedEntityTypes.length > 0 && { entity_types: selectedEntityTypes })
      };
    }

    return config;
  };

  const handleApply = () => {
    onApplyFilters(buildQueryConfig());
  };

  const handleClear = () => {
    setSearchText('');
    setFieldFilters([]);
    setEnableEnrichmentFilter(false);
    setSelectedProviders([]);
    setMinConfidence(0.7);
    setSelectedEntityTypes([]);
    onApplyFilters({ field_filters: [], logic: 'AND' });
  };

  const handleSave = () => {
    if (onSaveQuery) {
      onSaveQuery(buildQueryConfig());
    }
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev =>
      prev.includes(provider) ? prev.filter(p => p !== provider) : [...prev, provider]
    );
  };

  const toggleEntityType = (type: string) => {
    setSelectedEntityTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const renderValueInput = (filter: FieldFilter) => {
    const column = timeline.columns?.find(c => c.name === filter.field);
    
    if (filter.operator === 'between') {
      return (
        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <input
            type={column?.column_type === 'number' ? 'number' : column?.column_type === 'timestamp' ? 'date' : 'text'}
            placeholder="From"
            value={filter.value?.from || ''}
            onChange={(e) => updateFieldFilter(filter.id, { value: { ...filter.value, from: e.target.value } })}
            style={{ padding: '6px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#1f2937', color: '#fff', flex: 1 }}
          />
          <span style={{ color: '#9ca3af' }}>to</span>
          <input
            type={column?.column_type === 'number' ? 'number' : column?.column_type === 'timestamp' ? 'date' : 'text'}
            placeholder="To"
            value={filter.value?.to || ''}
            onChange={(e) => updateFieldFilter(filter.id, { value: { ...filter.value, to: e.target.value } })}
            style={{ padding: '6px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#1f2937', color: '#fff', flex: 1 }}
          />
        </div>
      );
    }

    return (
      <input
        type={column?.column_type === 'number' ? 'number' : column?.column_type === 'timestamp' ? 'date' : 'text'}
        placeholder="Value..."
        value={filter.value || ''}
        onChange={(e) => updateFieldFilter(filter.id, { value: e.target.value })}
        style={{ padding: '6px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#1f2937', color: '#fff', width: '100%' }}
      />
    );
  };

  const activeFilterCount = fieldFilters.filter(f => f.value !== '' && f.value !== null).length + 
                            (searchText ? 1 : 0) + 
                            (enableEnrichmentFilter ? 1 : 0);

  return (
    <div style={{ marginBottom: '15px' }}>
      <button
        onClick={() => setShowFilters(!showFilters)}
        style={{
          padding: '8px 16px',
          backgroundColor: activeFilterCount > 0 ? '#3b82f6' : '#4b5563',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 500,
        }}
      >
        🔍 Advanced Filters {activeFilterCount > 0 && `(${activeFilterCount} active)`}
      </button>

      {showFilters && (
        <div style={{ marginTop: '10px', padding: '20px', backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}>
          
          {/* Global Search */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>
              Global Search
            </label>
            <input
              type="text"
              placeholder="Search across all fields..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: '100%', padding: '8px', fontSize: '14px', border: '1px solid #374151', borderRadius: '6px', backgroundColor: '#111827', color: '#fff' }}
            />
          </div>

          {/* Logic Operator */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>Combine filters using:</label>
            <select
              value={logic}
              onChange={(e) => setLogic(e.target.value as 'AND' | 'OR')}
              style={{ padding: '6px 12px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#111827', color: '#fff' }}
            >
              <option value="AND">AND (all must match)</option>
              <option value="OR">OR (any can match)</option>
            </select>
          </div>

          {/* Field Filters */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>Field Filters</label>
              <button
                onClick={addFieldFilter}
                style={{ padding: '6px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
              >
                + Add Filter
              </button>
            </div>

            {fieldFilters.map((filter) => (
              <div key={filter.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                <select
                  value={filter.field}
                  onChange={(e) => updateFieldFilter(filter.id, { field: e.target.value })}
                  style={{ padding: '6px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#111827', color: '#fff', minWidth: '150px' }}
                >
                  {timeline.columns?.map(col => (
                    <option key={col.id} value={col.name}>{col.name}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={(e) => updateFieldFilter(filter.id, { operator: e.target.value })}
                  style={{ padding: '6px', fontSize: '13px', border: '1px solid #374151', borderRadius: '4px', backgroundColor: '#111827', color: '#fff', minWidth: '140px' }}
                >
                  {OPERATORS.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                <div style={{ flex: 1 }}>
                  {renderValueInput(filter)}
                </div>

                <button
                  onClick={() => removeFieldFilter(filter.id)}
                  style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
                >
                  ✕
                </button>
              </div>
            ))}

            {fieldFilters.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>No field filters added. Click "Add Filter" to create one.</p>
            )}
          </div>

          {/* Enrichment Filters */}
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
              <input
                type="checkbox"
                checked={enableEnrichmentFilter}
                onChange={(e) => setEnableEnrichmentFilter(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#f3f4f6' }}>Filter by Enrichment Data</label>
            </div>

            {enableEnrichmentFilter && (
              <div style={{ paddingLeft: '28px' }}>
                {/* Providers */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#d1d5db' }}>Enrichment Providers:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ENRICHMENT_PROVIDERS.map(provider => (
                      <button
                        key={provider}
                        onClick={() => toggleProvider(provider)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          border: '1px solid #374151',
                          borderRadius: '4px',
                          backgroundColor: selectedProviders.includes(provider) ? '#3b82f6' : '#1f2937',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {provider}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Entity Types */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#d1d5db' }}>Entity Types:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {ENTITY_TYPES.map(type => (
                      <button
                        key={type}
                        onClick={() => toggleEntityType(type)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          border: '1px solid #374151',
                          borderRadius: '4px',
                          backgroundColor: selectedEntityTypes.includes(type) ? '#10b981' : '#1f2937',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        {type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min Confidence */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#d1d5db' }}>
                    Minimum Confidence: {(minConfidence * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={minConfidence}
                    onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleApply}
              style={{ padding: '8px 20px', backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Apply Filters
            </button>
            <button
              onClick={handleClear}
              style={{ padding: '8px 20px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
            >
              Clear All
            </button>
            {onSaveQuery && (
              <button
                onClick={handleSave}
                style={{ padding: '8px 20px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
              >
                💾 Save Query
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
