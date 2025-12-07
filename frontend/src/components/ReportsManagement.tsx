import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../lib/api';
import { ReportTemplateEditor } from './ReportTemplateEditor';
import { ReportGenerator } from './ReportGenerator';

interface ReportTemplate {
  id: number;
  name: string;
  description?: string;
  category?: string;
  is_public: boolean;
  created_at: string;
}

interface Report {
  id: number;
  name: string;
  description?: string;
  entry_count: number;
  file_size?: number;
  generation_time?: number;
  format?: string;  // 'pdf' or 'docx'
  created_at: string;
}

interface Timeline {
  id: number;
  name: string;
}

interface Props {
  projectId: number;
  timelines: Timeline[];
}

export const ReportsManagement: React.FC<Props> = ({ projectId, timelines }) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'reports'>('reports');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | undefined>();
  const [showGenerator, setShowGenerator] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [projectId, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (activeTab === 'templates') {
        const response = await reportsAPI.listTemplates(projectId);
        setTemplates(response.data);
      } else {
        const response = await reportsAPI.listReports(projectId);
        setReports(response.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await reportsAPI.deleteTemplate(templateId);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete template');
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      await reportsAPI.deleteReport(reportId);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete report');
    }
  };

  const handleDownloadReport = async (reportId: number, reportName: string, format?: string) => {
    try {
      const blob = await reportsAPI.downloadReport(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'docx' ? 'docx' : 'pdf';
      a.download = `${reportName}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download report');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="reports-management">
      <div className="reports-header">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            Generated Reports
          </button>
          <button
            className={`tab ${activeTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            Templates
          </button>
        </div>

        <div className="header-actions">
          {activeTab === 'templates' ? (
            <button
              className="btn-primary"
              onClick={() => {
                setEditingTemplate(undefined);
                setShowTemplateEditor(true);
              }}
            >
              + New Template
            </button>
          ) : (
            <button
              className="btn-primary"
              onClick={() => setShowGenerator(true)}
            >
              Generate Report
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="reports-content">
        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : activeTab === 'templates' ? (
          templates.length === 0 ? (
            <div className="empty-state">
              <p>No templates yet</p>
              <button className="btn-secondary" onClick={() => setShowTemplateEditor(true)}>
                Create Your First Template
              </button>
            </div>
          ) : (
            <div className="items-grid">
              {templates.map((template) => (
                <div key={template.id} className="item-card">
                  <div className="item-header">
                    <h3>{template.name}</h3>
                    {template.category && (
                      <span className="badge">{template.category}</span>
                    )}
                  </div>
                  {template.description && (
                    <p className="item-description">{template.description}</p>
                  )}
                  <div className="item-meta">
                    <span>{formatDate(template.created_at)}</span>
                    {template.is_public && <span className="badge-public">Public</span>}
                  </div>
                  <div className="item-actions">
                    <button
                      className="btn-link"
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowTemplateEditor(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          reports.length === 0 ? (
            <div className="empty-state">
              <p>No reports yet</p>
              <button className="btn-secondary" onClick={() => setShowGenerator(true)}>
                Generate Your First Report
              </button>
            </div>
          ) : (
            <div className="items-grid">
              {reports.map((report) => (
                <div key={report.id} className="item-card">
                  <div className="item-header">
                    <h3>{report.name}</h3>
                  </div>
                  {report.description && (
                    <p className="item-description">{report.description}</p>
                  )}
                  <div className="item-stats">
                    <div className="stat">
                      <span className="stat-label">Entries:</span>
                      <span className="stat-value">{report.entry_count}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Size:</span>
                      <span className="stat-value">{formatFileSize(report.file_size)}</span>
                    </div>
                    {report.generation_time && (
                      <div className="stat">
                        <span className="stat-label">Generated in:</span>
                        <span className="stat-value">{report.generation_time.toFixed(2)}s</span>
                      </div>
                    )}
                  </div>
                  <div className="item-meta">
                    <span>{formatDate(report.created_at)}</span>
                  </div>
                  <div className="item-actions">
                    <button
                      className="btn-link primary"
                      onClick={() => handleDownloadReport(report.id, report.name, report.format)}
                    >
                      Download {report.format === 'docx' ? 'DOCX' : 'PDF'}
                    </button>
                    <button
                      className="btn-link danger"
                      onClick={() => handleDeleteReport(report.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {showTemplateEditor && (
        <div className="modal-overlay">
          <ReportTemplateEditor
            projectId={projectId}
            template={editingTemplate}
            onSave={() => {
              setShowTemplateEditor(false);
              loadData();
            }}
            onCancel={() => setShowTemplateEditor(false)}
          />
        </div>
      )}

      {showGenerator && (
        <ReportGenerator
          projectId={projectId}
          timelines={timelines}
          onClose={() => setShowGenerator(false)}
          onReportGenerated={(reportId) => {
            setShowGenerator(false);
            setActiveTab('reports');
            loadData();
          }}
        />
      )}

      <style>{`
        .reports-management {
          background: white;
          border-radius: 8px;
          padding: 24px;
        }

        .reports-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 2px solid #e2e8f0;
        }

        .tab {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          font-weight: 500;
          color: #718096;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: -2px;
        }

        .tab:hover {
          color: #2d3748;
        }

        .tab.active {
          color: #3182ce;
          border-bottom-color: #3182ce;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn-primary {
          padding: 10px 20px;
          background: #3182ce;
          color: white;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          background: #2c5aa0;
        }

        .btn-secondary {
          padding: 10px 20px;
          background: #e2e8f0;
          color: #2d3748;
          border: none;
          border-radius: 4px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-secondary:hover {
          background: #cbd5e0;
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

        .reports-content {
          min-height: 300px;
        }

        .loading-state, .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #718096;
        }

        .empty-state p {
          margin-bottom: 16px;
          font-size: 16px;
        }

        .items-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .item-card {
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 20px;
          transition: all 0.2s;
        }

        .item-card:hover {
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          border-color: #cbd5e0;
        }

        .item-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .item-card h3 {
          margin: 0;
          font-size: 16px;
          color: #2d3748;
          flex: 1;
        }

        .badge {
          background: #edf2f7;
          color: #4a5568;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
          margin-left: 8px;
        }

        .badge-public {
          background: #48bb78;
          color: white;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 12px;
        }

        .item-description {
          color: #718096;
          font-size: 14px;
          margin: 0 0 12px 0;
          line-height: 1.5;
        }

        .item-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
          padding: 12px 0;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 11px;
          color: #a0aec0;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 14px;
          color: #2d3748;
          font-weight: 600;
        }

        .item-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 13px;
          color: #a0aec0;
        }

        .item-actions {
          display: flex;
          gap: 16px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
        }

        .btn-link {
          background: none;
          border: none;
          color: #3182ce;
          font-weight: 500;
          cursor: pointer;
          padding: 0;
          font-size: 14px;
        }

        .btn-link:hover {
          text-decoration: underline;
        }

        .btn-link.primary {
          color: #3182ce;
        }

        .btn-link.danger {
          color: #e53e3e;
        }

        .modal-overlay {
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
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};
