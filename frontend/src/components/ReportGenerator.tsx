import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../lib/api';

interface ReportTemplate {
  id: number;
  name: string;
  description?: string;
  category?: string;
  is_public: boolean;
}

interface Timeline {
  id: number;
  name: string;
}

interface Props {
  projectId: number;
  timelines: Timeline[];
  onClose: () => void;
  onReportGenerated: (reportId: number) => void;
}

export const ReportGenerator: React.FC<Props> = ({ projectId, timelines, onClose, onReportGenerated }) => {
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTimeline, setSelectedTimeline] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryLimit, setEntryLimit] = useState(1000);
  const [format, setFormat] = useState<'pdf' | 'docx'>('pdf');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, [projectId]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await reportsAPI.listTemplates(projectId);
      setTemplates(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) {
      setError('Please select a template');
      return;
    }

    if (!reportName.trim()) {
      setError('Please enter a report name');
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const response = await reportsAPI.generateReport({
        template_id: selectedTemplate,
        project_id: projectId,
        timeline_id: selectedTimeline || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        entry_limit: entryLimit,
        name: reportName,
        description: description || undefined,
        format: format,
      });

      const report = response.data;
      onReportGenerated(report.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate report');
      setGenerating(false);
    }
  };

  const selectedTemplateData = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="report-generator-overlay">
      <div className="report-generator">
        <div className="generator-header">
          <h2>Generate Report</h2>
          <button onClick={onClose} className="btn-close" disabled={generating}>×</button>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-state">Loading templates...</div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <p>No report templates available for this project.</p>
            <p className="text-muted">Create a template first to generate reports.</p>
          </div>
        ) : (
          <div className="generator-form">
            <div className="form-section">
              <h3>1. Select Template</h3>
              <div className="template-list">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <div className="template-header">
                      <h4>{template.name}</h4>
                      {template.category && (
                        <span className="template-category">{template.category}</span>
                      )}
                    </div>
                    {template.description && (
                      <p className="template-description">{template.description}</p>
                    )}
                    {template.is_public && (
                      <span className="badge-public">Public</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-section">
              <h3>2. Report Details</h3>
              <div className="form-group">
                <label>Report Name *</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g., Q1 2024 Analysis"
                  className="form-control"
                  disabled={generating}
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className="form-control"
                  disabled={generating}
                />
              </div>

              <div className="form-group">
                <label>Output Format</label>
                <div className="format-options">
                  <label className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value="pdf"
                      checked={format === 'pdf'}
                      onChange={() => setFormat('pdf')}
                      disabled={generating}
                    />
                    <span>PDF (.pdf)</span>
                  </label>
                  <label className="format-option">
                    <input
                      type="radio"
                      name="format"
                      value="docx"
                      checked={format === 'docx'}
                      onChange={() => setFormat('docx')}
                      disabled={generating}
                    />
                    <span>Word Document (.docx)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>3. Data Filters</h3>
              <div className="form-group">
                <label>Timeline (optional)</label>
                <select
                  value={selectedTimeline || ''}
                  onChange={(e) => setSelectedTimeline(e.target.value ? Number(e.target.value) : null)}
                  className="form-control"
                  disabled={generating}
                >
                  <option value="">All Timelines</option>
                  {timelines.map((timeline) => (
                    <option key={timeline.id} value={timeline.id}>
                      {timeline.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="form-control"
                    disabled={generating}
                  />
                </div>

                <div className="form-group">
                  <label>End Date (optional)</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="form-control"
                    disabled={generating}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Entry Limit</label>
                <input
                  type="number"
                  value={entryLimit}
                  onChange={(e) => setEntryLimit(Number(e.target.value))}
                  min={1}
                  max={10000}
                  className="form-control"
                  disabled={generating}
                />
                <small className="form-text">Maximum number of entries to include (1-10,000)</small>
              </div>
            </div>
          </div>
        )}

        <div className="generator-actions">
          <button onClick={onClose} className="btn-secondary" disabled={generating}>
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            className="btn-primary"
            disabled={generating || !selectedTemplate || !reportName.trim() || templates.length === 0}
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        <style>{`
          .report-generator-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .report-generator {
            background: white;
            border-radius: 8px;
            padding: 24px;
            max-width: 800px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }

          .generator-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
          }

          .generator-header h2 {
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

          .btn-close:hover:not(:disabled) {
            color: #2d3748;
          }

          .btn-close:disabled {
            opacity: 0.5;
            cursor: not-allowed;
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

          .loading-state, .empty-state {
            text-align: center;
            padding: 40px;
            color: #718096;
          }

          .empty-state p {
            margin: 8px 0;
          }

          .text-muted {
            color: #a0aec0;
            font-size: 14px;
          }

          .generator-form {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .form-section {
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 20px;
          }

          .form-section:last-child {
            border-bottom: none;
          }

          .form-section h3 {
            margin: 0 0 16px 0;
            font-size: 16px;
            color: #2d3748;
            font-weight: 600;
          }

          .template-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 12px;
          }

          .template-card {
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
          }

          .template-card:hover {
            border-color: #cbd5e0;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
          }

          .template-card.selected {
            border-color: #3182ce;
            background: #ebf8ff;
          }

          .template-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 8px;
          }

          .template-card h4 {
            margin: 0;
            font-size: 15px;
            color: #2d3748;
          }

          .template-category {
            background: #edf2f7;
            color: #4a5568;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            white-space: nowrap;
          }

          .template-description {
            margin: 8px 0 0 0;
            font-size: 13px;
            color: #718096;
            line-height: 1.4;
          }

          .badge-public {
            display: inline-block;
            margin-top: 8px;
            background: #48bb78;
            color: white;
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 16px;
          }

          .form-group:last-child {
            margin-bottom: 0;
          }

          .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
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

          .form-control:disabled {
            background: #f7fafc;
            cursor: not-allowed;
          }

          .form-text {
            font-size: 12px;
            color: #718096;
            margin-top: 4px;
          }

          .format-options {
            display: flex;
            gap: 16px;
          }

          .format-option {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            padding: 10px 14px;
            border: 2px solid #e2e8f0;
            border-radius: 6px;
            transition: all 0.2s;
          }

          .format-option:hover {
            border-color: #cbd5e0;
            background: #f7fafc;
          }

          .format-option input[type="radio"] {
            cursor: pointer;
            width: 18px;
            height: 18px;
          }

          .format-option input[type="radio"]:checked + span {
            font-weight: 600;
            color: #3182ce;
          }

          .format-option input[type="radio"]:disabled {
            cursor: not-allowed;
          }

          .format-option span {
            font-size: 14px;
            color: #2d3748;
          }

          .generator-actions {
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
        `}</style>
      </div>
    </div>
  );
};
