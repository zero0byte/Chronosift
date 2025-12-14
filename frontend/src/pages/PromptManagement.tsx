import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { promptAPI } from '../lib/api';

interface AnalysisPrompt {
  id: number;
  prompt_type: 'priority' | 'attack' | 'chains' | 'report';
  name: string;
  description: string;
  system_prompt: string;
  user_prompt_template?: string;
  is_default: boolean;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

const PromptManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [prompts, setPrompts] = useState<AnalysisPrompt[]>([]);
  const [filteredPrompts, setFilteredPrompts] = useState<AnalysisPrompt[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<AnalysisPrompt | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    prompt_type: 'priority' as 'priority' | 'attack' | 'chains' | 'report',
    name: '',
    description: '',
    system_prompt: '',
    user_prompt_template: '',
    is_active: true,
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  useEffect(() => {
    filterPrompts();
  }, [prompts, selectedType]);

  const loadPrompts = async () => {
    try {
      setLoading(true);
      const response = await promptAPI.list({ include_inactive: true });
      setPrompts(response.data.prompts);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  };

  const filterPrompts = () => {
    if (selectedType === 'all') {
      setFilteredPrompts(prompts);
    } else {
      setFilteredPrompts(prompts.filter(p => p.prompt_type === selectedType));
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingPrompt(null);
    setFormData({
      prompt_type: 'priority',
      name: '',
      description: '',
      system_prompt: '',
      user_prompt_template: '',
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (prompt: AnalysisPrompt) => {
    if (prompt.is_default) {
      alert('Cannot edit default prompts. Create a new custom prompt instead.');
      return;
    }
    setIsCreating(false);
    setEditingPrompt(prompt);
    setFormData({
      prompt_type: prompt.prompt_type,
      name: prompt.name,
      description: prompt.description || '',
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template || '',
      is_active: prompt.is_active,
    });
    setShowModal(true);
  };

  const handleViewDefault = (prompt: AnalysisPrompt) => {
    setIsCreating(false);
    setEditingPrompt(prompt);
    setFormData({
      prompt_type: prompt.prompt_type,
      name: prompt.name,
      description: prompt.description || '',
      system_prompt: prompt.system_prompt,
      user_prompt_template: prompt.user_prompt_template || '',
      is_active: prompt.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isCreating) {
        await promptAPI.create(formData);
      } else if (editingPrompt && !editingPrompt.is_default) {
        await promptAPI.update(editingPrompt.id, formData);
      }
      setShowModal(false);
      loadPrompts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save prompt');
    }
  };

  const handleDelete = async (promptId: number) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;
    
    try {
      await promptAPI.delete(promptId);
      loadPrompts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete prompt');
    }
  };

  const handleResetToDefault = async (promptId: number) => {
    if (!confirm('Reset to default prompt? This will deactivate the custom prompt.')) return;
    
    try {
      await promptAPI.resetToDefault(promptId);
      loadPrompts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset to default');
    }
  };

  const handleSetActive = async (promptId: number) => {
    try {
      await promptAPI.update(promptId, { is_active: true });
      loadPrompts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to activate prompt');
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'priority': return 'Priority Analysis';
      case 'attack': return 'MITRE ATT&CK Mapping';
      case 'chains': return 'Attack Chain Detection';
      case 'report': return 'LLM Reporting';
      default: return type;
    }
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    <div style={{ minHeight: '100vh', backgroundColor: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#2d2d2d', borderBottom: '1px solid #444', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ padding: '8px 16px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '16px' }}
          >
            ← Dashboard
          </button>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#fff' }}>LLM Prompt Management</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ color: '#aaa' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>
            Manage analysis prompts for Priority, ATT&CK Mapping, Chain Detection, and LLM Reporting
          </p>
          <button
            onClick={handleCreate}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            + New Prompt
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'rgba(220, 38, 38, 0.1)', border: '1px solid #dc2626', borderRadius: '4px', color: '#f87171' }}>
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setSelectedType('all')}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedType === 'all' ? '#6366f1' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            All
          </button>
          <button
            onClick={() => setSelectedType('priority')}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedType === 'priority' ? '#6366f1' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Priority
          </button>
          <button
            onClick={() => setSelectedType('attack')}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedType === 'attack' ? '#6366f1' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ATT&CK
          </button>
          <button
            onClick={() => setSelectedType('chains')}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedType === 'chains' ? '#6366f1' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Chains
          </button>
          <button
            onClick={() => setSelectedType('report')}
            style={{
              padding: '10px 20px',
              backgroundColor: selectedType === 'report' ? '#6366f1' : '#444',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Report
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ display: 'inline-block', width: '48px', height: '48px', border: '4px solid #444', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '16px', color: '#aaa' }}>Loading prompts...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredPrompts.map((prompt) => (
              <div
                key={prompt.id}
                style={{
                  backgroundColor: '#2d2d2d',
                  border: prompt.is_active ? '2px solid #22c55e' : '1px solid #444',
                  borderRadius: '8px',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>{prompt.name}</h3>
                      <span
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: '4px',
                          backgroundColor: prompt.prompt_type === 'priority' ? 'rgba(59, 130, 246, 0.15)' : prompt.prompt_type === 'attack' ? 'rgba(147, 51, 234, 0.15)' : prompt.prompt_type === 'report' ? 'rgba(251, 146, 60, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: prompt.prompt_type === 'priority' ? '#60a5fa' : prompt.prompt_type === 'attack' ? '#a78bfa' : prompt.prompt_type === 'report' ? '#fb923c' : '#4ade80'
                        }}
                      >
                        {getTypeName(prompt.prompt_type)}
                      </span>
                      {prompt.is_default && (
                        <span style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', backgroundColor: '#444', color: '#ddd' }}>
                          Default
                        </span>
                      )}
                      {prompt.is_active && (
                        <span style={{ padding: '4px 8px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' }}>
                          Active
                        </span>
                      )}
                    </div>
                    {prompt.description && (
                      <p style={{ color: '#aaa', marginTop: '8px', marginBottom: '8px' }}>{prompt.description}</p>
                    )}
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#888' }}>
                      Version {prompt.version} • Updated {new Date(prompt.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    {prompt.is_default ? (
                      <button
                        onClick={() => handleViewDefault(prompt)}
                        style={{
                          padding: '8px 16px',
                          fontSize: '14px',
                          backgroundColor: '#444',
                          color: '#ddd',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: '500'
                        }}
                      >
                        View
                      </button>
                    ) : (
                      <>
                        {!prompt.is_active && (
                          <button
                            onClick={() => handleSetActive(prompt.id)}
                            style={{
                              padding: '8px 16px',
                              fontSize: '14px',
                              backgroundColor: '#22c55e',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(prompt)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleResetToDefault(prompt.id)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: '#f59e0b',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Reset
                        </button>
                        <button
                          onClick={() => handleDelete(prompt.id)}
                          style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            backgroundColor: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {filteredPrompts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
                No prompts found for this type.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for creating/editing prompts */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#2d2d2d', borderRadius: '8px', maxWidth: '1000px', width: '100%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #444' }}>
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '20px', color: '#fff' }}>
                {isCreating
                  ? 'Create New Prompt'
                  : editingPrompt?.is_default
                  ? 'View Default Prompt'
                  : 'Edit Prompt'}
              </h2>
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                      Prompt Type
                    </label>
                    <select
                      value={formData.prompt_type}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prompt_type: e.target.value as 'priority' | 'attack' | 'chains' | 'report',
                        })
                      }
                      disabled={!isCreating || (editingPrompt?.is_default ?? false)}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: editingPrompt?.is_default ? '#1a1a1a' : '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px' }}
                    >
                      <option value="priority">Priority Analysis</option>
                      <option value="attack">MITRE ATT&CK Mapping</option>
                      <option value="chains">Attack Chain Detection</option>
                      <option value="report">LLM Reporting</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      disabled={editingPrompt?.is_default ?? false}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={2}
                      disabled={editingPrompt?.is_default ?? false}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                      System Prompt *
                    </label>
                    <textarea
                      value={formData.system_prompt}
                      onChange={(e) =>
                        setFormData({ ...formData, system_prompt: e.target.value })
                      }
                      required
                      rows={15}
                      disabled={editingPrompt?.is_default ?? false}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}
                      placeholder="Enter the system prompt for the LLM..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#ddd', marginBottom: '8px' }}>
                      User Prompt Template (Optional)
                    </label>
                    <textarea
                      value={formData.user_prompt_template}
                      onChange={(e) =>
                        setFormData({ ...formData, user_prompt_template: e.target.value })
                      }
                      rows={5}
                      disabled={editingPrompt?.is_default ?? false}
                      style={{ width: '100%', padding: '8px 12px', backgroundColor: '#1a1a1a', border: '1px solid #444', borderRadius: '4px', color: '#fff', fontSize: '14px', fontFamily: 'monospace' }}
                      placeholder="Optional template for user prompt with placeholders..."
                    />
                  </div>

                  {!editingPrompt?.is_default && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) =>
                          setFormData({ ...formData, is_active: e.target.checked })
                        }
                        style={{ marginRight: '8px' }}
                      />
                      <label style={{ fontSize: '14px', color: '#ddd' }}>
                        Set as active prompt (will deactivate other custom prompts of this type)
                      </label>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{ padding: '8px 16px', backgroundColor: '#444', color: '#ddd', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    {editingPrompt?.is_default ? 'Close' : 'Cancel'}
                  </button>
                  {!editingPrompt?.is_default && (
                    <button
                      type="submit"
                      style={{ padding: '8px 16px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                    >
                      {isCreating ? 'Create' : 'Save Changes'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default PromptManagement;
