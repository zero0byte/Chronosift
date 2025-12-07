import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../lib/api';

interface ReportTemplate {
  id?: number;
  name: string;
  description?: string;
  project_id: number;
  template_content: string;
  config?: {
    page_size?: string;
    orientation?: string;
  };
  is_public?: boolean;
  category?: string;
}

interface Props {
  projectId: number;
  template?: ReportTemplate;
  onSave: () => void;
  onCancel: () => void;
}

const DEFAULT_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <title>{{ project.name }} - Report</title>
</head>
<body>
  <h1>{{ project.name }}</h1>
  <p>{{ project.description }}</p>
  
  <div class="stats">
    <h2>Summary</h2>
    <p><strong>Total Entries:</strong> {{ stats.total_entries }}</p>
    <p><strong>Generated:</strong> {{ generated_at }}</p>
  </div>
  
  <h2>Timeline Entries</h2>
  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Timestamp</th>
        <th>Description</th>
      </tr>
    </thead>
    <tbody>
      {% for entry in entries %}
      <tr>
        <td>{{ entry.id }}</td>
        <td>{{ entry.data.Timestamp or entry.data.TimeCreated or entry.data.Created0x10 or entry.data.LastModified }}</td>
        <td>{{ entry.data.Description or entry.data.Message or entry.data.DESCRIPTION or entry.data.FullPath or entry.data.Name or entry.data.TargetName or '' }}</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>
</body>
</html>`;

export const ReportTemplateEditor: React.FC<Props> = ({ projectId, template, onSave, onCancel }) => {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [templateContent, setTemplateContent] = useState(template?.template_content || DEFAULT_TEMPLATE);
  const [isPublic, setIsPublic] = useState(template?.is_public || false);
  const [category, setCategory] = useState(template?.category || '');
  const [pageSize, setPageSize] = useState(template?.config?.page_size || 'A4');
  const [orientation, setOrientation] = useState(template?.config?.orientation || 'portrait');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!templateContent.trim()) {
      setError('Template content is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const data = {
        name,
        description,
        project_id: projectId,
        template_content: templateContent,
        config: {
          page_size: pageSize,
          orientation
        },
        is_public: isPublic,
        category: category || undefined
      };

      if (template?.id) {
        await reportsAPI.updateTemplate(template.id, data);
      } else {
        await reportsAPI.createTemplate(data);
      }

      onSave();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save template');
      setSaving(false);
    }
  };

  return (
    <div className="report-template-editor">
      <div className="editor-header">
        <h2>{template ? 'Edit Template' : 'Create Template'}</h2>
        <button onClick={onCancel} className="btn-close">×</button>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="editor-form">
        <div className="form-group">
          <label>Template Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Executive Summary"
            className="form-control"
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this template"
            rows={2}
            className="form-control"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Timeline Summary"
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Page Size</label>
            <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="form-control">
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
              <option value="Legal">Legal</option>
            </select>
          </div>

          <div className="form-group">
            <label>Orientation</label>
            <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="form-control">
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
            <span>Make this template public (visible to all project members)</span>
          </label>
        </div>

        <div className="form-group">
          <div className="editor-toolbar">
            <label>Template Content (HTML + Jinja2)</label>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary btn-sm"
            >
              {showPreview ? 'Hide' : 'Show'} Variables Guide
            </button>
          </div>

          {showPreview && (
            <div className="template-guide">
              <h4>Available Variables:</h4>
              <ul>
                <li><code>{'{{ project.name }}'}</code> - Project name</li>
                <li><code>{'{{ project.description }}'}</code> - Project description</li>
                <li><code>{'{{ stats.total_entries }}'}</code> - Total entry count</li>
                <li><code>{'{{ generated_at }}'}</code> - Report generation timestamp</li>
                <li><code>{'{% for entry in entries %}'}</code> - Loop through entries</li>
                <li><code>{'{{ timelines }}'}</code> - List of timelines</li>
              </ul>
              <h4>Accessing Entry Fields:</h4>
              <ul>
                <li><code>{'{{ entry.id }}'}</code> - Entry ID</li>
                <li><code>{'{{ entry.data.FieldName }}'}</code> - For fields without spaces</li>
                <li><code>{'{{ entry.data["Field Name"] }}'}</code> - For fields WITH spaces (use brackets)</li>
                <li><code>{'{{ entry.data.Field1 or entry.data.Field2 }}'}</code> - Try multiple fields</li>
              </ul>
              <h4>Common Field Examples:</h4>
              <ul>
                <li><code>{'{{ entry.data.Timestamp }}'}</code> or <code>{'{{ entry.data["Time Created"] }}'}</code></li>
                <li><code>{'{{ entry.data.Description }}'}</code> or <code>{'{{ entry.data["Event Name"] }}'}</code></li>
                <li><code>{'{{ entry.data.Name }}'}</code> or <code>{'{{ entry.data["Full Path"] }}'}</code></li>
              </ul>
            </div>
          )}

          <textarea
            value={templateContent}
            onChange={(e) => setTemplateContent(e.target.value)}
            rows={20}
            className="form-control code-editor"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="editor-actions">
        <button onClick={onCancel} className="btn-secondary" disabled={saving}>
          Cancel
        </button>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Template'}
        </button>
      </div>

      <style>{`
        .report-template-editor {
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 1000px;
          margin: 0 auto;
        }

        .editor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .editor-header h2 {
          margin: 0;
          color: #1a202c;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 28px;
          cursor: pointer;
          color: #718096;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .btn-close:hover {
          color: #2d3748;
        }

        .alert {
          padding: 12px 16px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .alert-error {
          background-color: #fee;
          color: #c53030;
          border: 1px solid #fc8181;
        }

        .editor-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 16px;
        }

        .form-group label {
          font-weight: 500;
          color: #2d3748;
          font-size: 14px;
        }

        .form-control {
          padding: 8px 12px;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }

        .form-control:focus {
          outline: none;
          border-color: #3182ce;
          box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
        }

        .code-editor {
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: normal;
        }

        .checkbox-label input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .template-guide {
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          padding: 12px 16px;
        }

        .template-guide h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #2d3748;
        }

        .template-guide ul {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          line-height: 1.8;
        }

        .template-guide code {
          background: #edf2f7;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Monaco', 'Menlo', monospace;
          font-size: 12px;
          color: #2d3748;
        }

        .editor-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e2e8f0;
        }

        .btn-primary, .btn-secondary {
          padding: 10px 20px;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          font-size: 14px;
          border: none;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3182ce;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2c5aa0;
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #e2e8f0;
          color: #2d3748;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #cbd5e0;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
};
