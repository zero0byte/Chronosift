import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { transformAPI } from '../lib/api';

export default function Transforms() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [transforms, setTransforms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTransform, setNewTransform] = useState<{
    name: string;
    description: string;
    input_format: 'csv' | 'json' | 'xml';
    mapping: {
      fields: Array<{ source: string; target: string; type: string }>;
      options: { csv_delimiter: string; csv_has_header: boolean; skip_errors: boolean };
    };
  }>({
    name: '',
    description: '',
    input_format: 'csv',
    mapping: {
      fields: [],
      options: { csv_delimiter: ',', csv_has_header: true, skip_errors: true }
    }
  });
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [targetColumn, setTargetColumn] = useState('');
  const [showApiModal, setShowApiModal] = useState(false);

  useEffect(() => {
    loadTransforms();
  }, []);

  const loadTransforms = async () => {
    try {
      const res = await transformAPI.list();
      setTransforms(res.data.transforms);
    } catch (error) {
      console.error('Failed to load transforms:', error);
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    if (!fieldName || !targetColumn) {
      alert('Please enter both source field and target column');
      return;
    }
    const newField = {
      source: fieldName,
      target: targetColumn,
      type: fieldType
    };
    setNewTransform({
      ...newTransform,
      mapping: {
        ...newTransform.mapping,
        fields: [...newTransform.mapping.fields, newField]
      }
    });
    setFieldName('');
    setTargetColumn('');
  };

  const removeField = (index: number) => {
    const fields = [...newTransform.mapping.fields];
    fields.splice(index, 1);
    setNewTransform({
      ...newTransform,
      mapping: {
        ...newTransform.mapping,
        fields
      }
    });
  };

  const handleCreate = async () => {
    if (!newTransform.name) {
      alert('Please enter a transform name');
      return;
    }
    if (newTransform.mapping.fields.length === 0) {
      alert('Please add at least one field mapping');
      return;
    }
    try {
      await transformAPI.create(newTransform);
      setShowCreate(false);
      setNewTransform({
        name: '',
        description: '',
        input_format: 'csv',
        mapping: {
          fields: [],
          options: { csv_delimiter: ',', csv_has_header: true, skip_errors: true }
        }
      });
      loadTransforms();
    } catch (error: any) {
      console.error('Failed to create transform:', error);
      alert(`Failed to create transform: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this transform?')) return;
    try {
      await transformAPI.delete(id);
      loadTransforms();
    } catch (error) {
      console.error('Failed to delete transform:', error);
      alert('Failed to delete transform');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ margin: 0 }}>Transforms</h1>
        </div>
        <div>
          <span style={{ marginRight: '20px' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>My Transforms</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => navigate('/transforms/new')}
              style={{ padding: '10px 20px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Create Transform
            </button>
            <button
              onClick={() => setShowCreate(!showCreate)}
              style={{ padding: '10px 20px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Quick Create
            </button>
          </div>
        </div>

        {showCreate && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '20px', marginBottom: '20px' }}>
            <h3>Create New Transform</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Name *</label>
                <input
                  type="text"
                  value={newTransform.name}
                  onChange={(e) => setNewTransform({ ...newTransform, name: e.target.value })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Input Format</label>
                <select
                  value={newTransform.input_format}
                  onChange={(e) => setNewTransform({ ...newTransform, input_format: e.target.value as 'csv' | 'json' | 'xml' })}
                  style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="xml">XML</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description</label>
              <textarea
                value={newTransform.description}
                onChange={(e) => setNewTransform({ ...newTransform, description: e.target.value })}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', minHeight: '60px' }}
              />
            </div>

            <h4>Field Mappings</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr auto', gap: '10px', marginBottom: '10px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px' }}>Source Field</label>
                <input
                  type="text"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="e.g., timestamp or data.time"
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px' }}>Target Column</label>
                <input
                  type="text"
                  value={targetColumn}
                  onChange={(e) => setTargetColumn(e.target.value)}
                  placeholder="e.g., Timestamp"
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px' }}>Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  style={{ width: '100%', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }}
                >
                  <option value="text">Text</option>
                  <option value="timestamp">Timestamp</option>
                  <option value="number">Number</option>
                  <option value="tags">Tags</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>
              <button
                onClick={addField}
                style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Add Field
              </button>
            </div>

            {newTransform.mapping.fields.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <strong>Mapped Fields:</strong>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {newTransform.mapping.fields.map((field: any, idx: number) => (
                    <div key={idx} style={{ padding: '8px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>{field.source}</strong> → <strong>{field.target}</strong> ({field.type})</span>
                      <button
                        onClick={() => removeField(idx)}
                        style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCreate}
                style={{ padding: '10px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Create Transform
              </button>
              <button
                onClick={() => setShowCreate(false)}
                style={{ padding: '10px 20px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {transforms.map((transform) => (
            <div key={transform.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>{transform.name}</h3>
                <span style={{ fontSize: '12px', backgroundColor: '#007bff', color: '#fff', padding: '4px 8px', borderRadius: '3px' }}>
                  {transform.input_format.toUpperCase()}
                </span>
              </div>
              {transform.description && <p style={{ color: '#666', fontSize: '14px' }}>{transform.description}</p>}
              <div style={{ fontSize: '13px', color: '#999', marginBottom: '15px' }}>
                {transform.mapping.fields?.length || 0} field mappings
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    if (transform.imported_via_api) {
                      setShowApiModal(true);
                    } else {
                      navigate(`/transforms/${transform.id}`);
                    }
                  }}
                  style={{ padding: '6px 12px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(transform.id)}
                  style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {transforms.length === 0 && !showCreate && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            No transforms yet. Create one to get started!
          </div>
        )}
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
          onClick={() => setShowApiModal(false)}
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
              onClick={() => setShowApiModal(false)}
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
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
