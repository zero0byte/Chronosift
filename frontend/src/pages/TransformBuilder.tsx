import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { transformAPI } from '../lib/api';

interface FieldMapping {
  source: string;
  target: string;
  type: 'timestamp' | 'text' | 'number' | 'tags' | 'boolean';
  format?: string; // for timestamp
  default?: string;
}

interface MappingConfig {
  fields: FieldMapping[];
  options: {
    csv_delimiter?: string;
    csv_has_header?: boolean;
    json_path?: string;
    xml_record_path?: string;
    skip_errors?: boolean;
  };
}

export default function TransformBuilder() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== 'new';
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [loading, setLoading] = useState<boolean>(!!isEdit);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState<'csv' | 'json' | 'xml'>('csv');
  const [isPublic, setIsPublic] = useState(false);

  const [mapping, setMapping] = useState<MappingConfig>({
    fields: [],
    options: { csv_delimiter: ',', csv_has_header: true, skip_errors: true },
  });

  const [sampleData, setSampleData] = useState('');
  const [preview, setPreview] = useState<any[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showApiModal, setShowApiModal] = useState(false);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        try {
          const res = await transformAPI.get(Number(id));
          const t = res.data.transform;
          
          // Check if this transform was imported via API
          if (t.imported_via_api) {
            setShowApiModal(true);
            return;
          }
          
          setName(t.name);
          setDescription(t.description || '');
          setInputFormat(t.input_format);
          setIsPublic(!!t.is_public);
          setMapping(t.mapping || { fields: [], options: {} });
        } catch (e) {
          console.error('Failed to load transform', e);
          alert('Failed to load transform');
          navigate('/transforms');
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [id]);

  const addField = () => {
    setMapping(m => ({
      ...m,
      fields: [
        ...m.fields,
        { source: '', target: '', type: 'text' },
      ],
    }));
  };

  const updateField = (idx: number, patch: Partial<FieldMapping>) => {
    setMapping(m => ({
      ...m,
      fields: m.fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)),
    }));
  };

  const removeField = (idx: number) => {
    setMapping(m => ({
      ...m,
      fields: m.fields.filter((_, i) => i !== idx),
    }));
  };

  const moveField = (idx: number, dir: -1 | 1) => {
    setMapping(m => {
      const arr = [...m.fields];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= arr.length) return m;
      const [item] = arr.splice(idx, 1);
      arr.splice(newIdx, 0, item);
      return { ...m, fields: arr };
    });
  };

  const canSave = useMemo(() => name.trim() && mapping.fields.length > 0, [name, mapping.fields.length]);

  const runTest = async () => {
    setTesting(true);
    setPreview(null);
    setPreviewError(null);
    try {
      if (!sampleData.trim()) {
        setPreviewError('Please paste sample data to test');
        return;
      }
      const res = isEdit
        ? await transformAPI.test(Number(id), sampleData)
        : await transformAPI.testInline(inputFormat, mapping as any, sampleData);
      if (res.data.success) {
        setPreview(res.data.preview || []);
      } else {
        setPreviewError(res.data.error || 'Unknown error');
      }
    } catch (e: any) {
      setPreviewError(e.response?.data?.error || e.message);
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit) {
        await transformAPI.update(Number(id), {
          name,
          description,
          mapping,
          is_public: isPublic,
        });
      } else {
        await transformAPI.create({
          name,
          description,
          input_format: inputFormat,
          mapping,
          is_public: isPublic,
        } as any);
      }
      navigate('/transforms');
    } catch (e: any) {
      alert(`Failed to save: ${e.response?.data?.error || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/transforms')} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ margin: 0 }}>{isEdit ? 'Edit Transform' : 'New Transform'}</h1>
        </div>
        <div>
          <span style={{ marginRight: 20 }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        {/* Meta */}
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Transform name" style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Visibility</label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /> Public
              </label>
            </div>
            <div style={{ gridColumn: '1 / span 2' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this transform" style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4, minHeight: 60 }} />
            </div>
          </div>
        </div>

        {/* Format & Options */}
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Input Format</label>
              <select disabled={isEdit} value={inputFormat} onChange={e => setInputFormat(e.target.value as any)} style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }}>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xml">XML</option>
              </select>
            </div>
            <div>
              {/* Options per format */}
              {inputFormat === 'csv' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Delimiter</label>
                    <input value={mapping.options.csv_delimiter || ','} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, csv_delimiter: e.target.value } }))} style={{ width: 80, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
                  </div>
                  <div style={{ alignSelf: 'end' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={mapping.options.csv_has_header ?? true} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, csv_has_header: e.target.checked } }))} /> Has header
                    </label>
                  </div>
                  <div style={{ alignSelf: 'end' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={mapping.options.skip_errors ?? true} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, skip_errors: e.target.checked } }))} /> Skip errors
                    </label>
                  </div>
                </div>
              )}
              {inputFormat === 'json' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>JSON Path to Array</label>
                    <input value={mapping.options.json_path || ''} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, json_path: e.target.value } }))} placeholder="e.g., data.items" style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
                  </div>
                  <div style={{ alignSelf: 'end' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={mapping.options.skip_errors ?? true} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, skip_errors: e.target.checked } }))} /> Skip errors
                    </label>
                  </div>
                </div>
              )}
              {inputFormat === 'xml' && (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Record XPath</label>
                    <input value={mapping.options.xml_record_path || ''} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, xml_record_path: e.target.value } }))} placeholder="e.g., root/record" style={{ width: '100%', padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
                  </div>
                  <div style={{ alignSelf: 'end' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="checkbox" checked={mapping.options.skip_errors ?? true} onChange={e => setMapping(m => ({ ...m, options: { ...m.options, skip_errors: e.target.checked } }))} /> Skip errors
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Field mappings */}
        <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Field Mappings</h3>
            <button onClick={addField} style={{ padding: '8px 12px', background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>+ Add Field</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Source Path</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Target Column</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Date Format</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Default</th>
                  <th style={{ textAlign: 'left', padding: 8 }}></th>
                </tr>
              </thead>
              <tbody>
                {mapping.fields.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 16, textAlign: 'center', color: '#777' }}>No fields yet. Click "+ Add Field".</td>
                  </tr>
                )}
                {mapping.fields.map((f, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: 8 }}>
                      <input value={f.source} onChange={e => updateField(idx, { source: e.target.value })} placeholder="e.g., Timestamp or data.time" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input value={f.target} onChange={e => updateField(idx, { target: e.target.value })} placeholder="e.g., Timestamp" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <select value={f.type} onChange={e => updateField(idx, { type: e.target.value as any })} style={{ padding: 6, border: '1px solid #ccc', borderRadius: 4 }}>
                        <option value="text">Text</option>
                        <option value="timestamp">Timestamp</option>
                        <option value="number">Number</option>
                        <option value="tags">Tags</option>
                        <option value="boolean">Boolean</option>
                      </select>
                    </td>
                    <td style={{ padding: 8 }}>
                      <input value={f.format || ''} onChange={e => updateField(idx, { format: e.target.value })} placeholder="e.g., yyyy-MM-dd HH:mm:ss" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} disabled={f.type !== 'timestamp'} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input value={f.default || ''} onChange={e => updateField(idx, { default: e.target.value })} placeholder="Default value" style={{ width: '100%', padding: 6, border: '1px solid #ccc', borderRadius: 4 }} />
                    </td>
                    <td style={{ padding: 8, whiteSpace: 'nowrap' }}>
                      <button onClick={() => moveField(idx, -1)} style={{ padding: '4px 8px', marginRight: 6, cursor: 'pointer' }}>↑</button>
                      <button onClick={() => moveField(idx, 1)} style={{ padding: '4px 8px', marginRight: 6, cursor: 'pointer' }}>↓</button>
                      <button onClick={() => removeField(idx)} style={{ padding: '4px 8px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sample & Preview */}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0 }}>Sample Data</h3>
              <button onClick={runTest} disabled={testing} style={{ padding: '8px 12px', background: '#007bff', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>{testing ? 'Testing...' : 'Run Test'}</button>
            </div>
            <textarea value={sampleData} onChange={e => setSampleData(e.target.value)} placeholder={inputFormat === 'csv' ? 'Paste CSV content...' : inputFormat === 'json' ? 'Paste JSON...' : 'Paste XML...'} style={{ width: '100%', minHeight: 200, padding: 8, border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
          <div style={{ background: '#fff', border: '1px solid #ddd', borderRadius: 4, padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Preview</h3>
            {previewError && (
              <div style={{ color: '#dc3545', marginBottom: 8 }}>{previewError}</div>
            )}
            {!preview && !previewError && (
              <div style={{ color: '#777' }}>Run a test to see preview...</div>
            )}
            {preview && preview.length === 0 && (
              <div style={{ color: '#777' }}>No records parsed.</div>
            )}
            {preview && preview.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      {Object.keys(preview[0]).map((k) => (
                        <th key={k} style={{ textAlign: 'left', padding: 8 }}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #eee' }}>
                        {Object.keys(preview[0]).map((k) => (
                          <td key={k} style={{ padding: 8, fontSize: 13 }}>{String((row as any)[k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSave} disabled={!canSave || saving} style={{ padding: '10px 16px', background: canSave ? '#28a745' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, cursor: canSave ? 'pointer' : 'not-allowed' }}>{saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Transform'}</button>
          <button onClick={() => navigate('/transforms')} style={{ padding: '10px 16px', cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>

      {/* API Import Modal */}
      {showApiModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => {
            setShowApiModal(false);
            navigate('/transforms');
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '500px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '15px' }}>API Imported Transform</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              This transform was imported via API. Please contact the responsible user to make changes.
            </p>
            <button
              onClick={() => {
                setShowApiModal(false);
                navigate('/transforms');
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              Back to Transforms
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
