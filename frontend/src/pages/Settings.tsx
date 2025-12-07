import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { enrichmentAPI } from '../lib/api';

interface Provider {
  id: number;
  name: string;
  entity_type: string;
  description: string;
  requires_api_key: boolean;
  has_key: boolean;
}

interface APIKey {
  id: number;
  provider_id: number;
  key_name: string;
  created_at: string;
}

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [apiKeys, setAPIKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Add/Edit key modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersRes, keysRes] = await Promise.all([
        enrichmentAPI.listProviders(),
        enrichmentAPI.listAPIKeys()
      ]);
      setProviders(providersRes.data);
      setAPIKeys(keysRes.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load enrichment settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = (provider: Provider) => {
    setSelectedProvider(provider);
    setApiKey('');
    setKeyName('');
    setShowKeyModal(true);
  };

  const handleSaveKey = async () => {
    if (!selectedProvider || !apiKey) {
      setError('API key is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await enrichmentAPI.addAPIKey({
        provider_id: selectedProvider.id,
        api_key: apiKey,
        key_name: keyName
      });
      
      setSuccess(`API key for ${selectedProvider.name} saved successfully`);
      setShowKeyModal(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }

    try {
      await enrichmentAPI.deleteAPIKey(keyId);
      setSuccess('API key deleted successfully');
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete API key');
    }
  };

  const getProviderByKeyId = (keyId: number): Provider | undefined => {
    const key = apiKeys.find(k => k.id === keyId);
    return key ? providers.find(p => p.id === key.provider_id) : undefined;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#1a1a1a' }}>
        {/* Header */}
        <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #444', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '16px' }}
            >
              ← Back
            </button>
            <h1 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Settings</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#aaa' }}>{user?.full_name}</span>
            <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
          </div>
        </div>
        <div style={{ padding: '30px' }}>
          <div style={{ color: '#aaa' }}>Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #444', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          >
            ← Back
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>Settings</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ color: '#aaa' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Settings Navigation */}
        {user?.is_admin && (
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#2d2d2d', border: '1px solid #444', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#fff' }}>Admin Settings</h3>
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/jobs')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                📊 Job Management
              </button>
              <button
                onClick={() => navigate('/prompts')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#9333ea',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🤖 LLM Prompt Management
              </button>
              <button
                onClick={() => window.open('http://localhost:5555', '_blank')}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#444',
                  color: '#ddd',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🌸 Flower (Celery Monitor)
              </button>
            </div>
          </div>
        )}
        
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '30px', color: '#fff' }}>Enrichment Settings</h2>

        {/* Status messages */}
        {error && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', borderRadius: '4px', color: '#f87171' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid #22c55e', borderRadius: '4px', color: '#4ade80' }}>
            {success}
          </div>
        )}

        {/* API Keys Section */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#ddd' }}>Your API Keys</h3>
          
          {apiKeys.length === 0 ? (
            <div style={{ backgroundColor: '#2d2d2d', padding: '20px', borderRadius: '4px', border: '1px solid #444', color: '#aaa' }}>
              No API keys configured yet. Add keys below to enable enrichment.
            </div>
          ) : (
            <div style={{ backgroundColor: '#2d2d2d', borderRadius: '4px', border: '1px solid #444', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#1a1a1a' }}>
                  <tr>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Provider</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entity Type</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Key Name</th>
                    <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Added</th>
                    <th style={{ padding: '12px 20px', textAlign: 'right', fontSize: '11px', fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key) => {
                    const provider = getProviderByKeyId(key.id);
                    return (
                      <tr key={key.id} style={{ borderTop: '1px solid #444' }}>
                        <td style={{ padding: '15px 20px', whiteSpace: 'nowrap', fontSize: '14px', fontWeight: '500', color: '#fff' }}>
                          {provider?.name || 'Unknown'}
                        </td>
                        <td style={{ padding: '15px 20px', whiteSpace: 'nowrap', fontSize: '14px', color: '#ddd' }}>
                          <span style={{ padding: '4px 8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }}>
                            {provider?.entity_type || 'unknown'}
                          </span>
                        </td>
                        <td style={{ padding: '15px 20px', whiteSpace: 'nowrap', fontSize: '14px', color: '#aaa' }}>
                          {key.key_name || '-'}
                        </td>
                        <td style={{ padding: '15px 20px', whiteSpace: 'nowrap', fontSize: '14px', color: '#aaa' }}>
                          {new Date(key.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '15px 20px', whiteSpace: 'nowrap', textAlign: 'right', fontSize: '14px' }}>
                          <button
                            onClick={() => handleDeleteKey(key.id)}
                            style={{ color: '#f87171', border: 'none', background: 'none', cursor: 'pointer' }}
                          >
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
            </table>
          </div>
        )}
      </div>

        {/* Available Providers Section */}
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '15px', color: '#ddd' }}>Available Enrichment Providers</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
            {providers.map((provider) => (
              <div
                key={provider.id}
                style={{ backgroundColor: '#2d2d2d', padding: '20px', borderRadius: '4px', border: '1px solid #444' }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '6px' }}>{provider.name}</h4>
                    <span style={{ display: 'inline-block', padding: '4px 8px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', borderRadius: '3px', fontSize: '12px', fontFamily: 'monospace' }}>
                      {provider.entity_type}
                    </span>
                  </div>
                  {provider.has_key && (
                    <span style={{ color: '#4ade80', fontSize: '14px' }}>✓ Configured</span>
                  )}
                </div>
                
                <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '15px' }}>{provider.description}</p>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {provider.requires_api_key ? (
                    <>
                      <span style={{ fontSize: '12px', color: '#888' }}>API key required</span>
                      <button
                        onClick={() => handleAddKey(provider)}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: provider.has_key ? '#444' : '#007bff',
                          color: provider.has_key ? '#ddd' : '#fff'
                        }}
                      >
                        {provider.has_key ? 'Update Key' : 'Add Key'}
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#4ade80' }}>No API key required</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add/Edit Key Modal */}
        {showKeyModal && selectedProvider && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#2d2d2d', borderRadius: '4px', padding: '30px', maxWidth: '500px', width: '100%', border: '1px solid #444' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px', color: '#fff' }}>
                {selectedProvider.name} API Key
              </h3>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                  API Key <span style={{ color: '#f87171' }}>*</span>
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px' }}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                  Key Name (optional)
                </label>
                <input
                  type="text"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px' }}
                />
              </div>
              
              {error && (
                <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', borderRadius: '4px', color: '#f87171', fontSize: '14px' }}>
                  {error}
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowKeyModal(false)}
                  disabled={saving}
                  style={{ padding: '8px 16px', backgroundColor: '#444', color: '#ddd', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', opacity: saving ? 0.5 : 1 }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveKey}
                  disabled={saving || !apiKey}
                  style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: saving || !apiKey ? 'not-allowed' : 'pointer', fontSize: '14px', opacity: saving || !apiKey ? 0.5 : 1 }}
                >
                  {saving ? 'Saving...' : 'Save Key'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
