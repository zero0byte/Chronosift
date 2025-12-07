import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { jobsAPI } from '../lib/api';
import { Job, JobStats } from '../types';

export default function JobManagement() {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const loadDataSafe = async () => {
      if (mounted) {
        await loadData();
      }
    };
    
    loadDataSafe();
    
    // Auto-refresh every 3 seconds if enabled
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(loadDataSafe, 3000);
    }
    
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, statusFilter, taskTypeFilter]);

  const loadData = async () => {
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (taskTypeFilter) params.task_type = taskTypeFilter;
      
      const [jobsRes, statsRes] = await Promise.all([
        jobsAPI.list(params),
        jobsAPI.getStats()
      ]);
      
      setJobs(jobsRes.data.jobs);
      setStats(statsRes.data.stats);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load jobs:', error);
      // Don't show error if component is unmounting or user navigated away
      if (error?.code !== 'ERR_CANCELED') {
        // Check if it's a server error (5xx)
        if (error?.response?.status >= 500) {
          console.error('Server error - backend may need restart:', error.response.status);
        }
        setLoading(false);
      }
    }
  };

  const handleCancelJob = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to cancel this job?')) return;
    
    try {
      await jobsAPI.cancel(jobId);
      loadData();
      alert('Job cancelled successfully');
    } catch (error: any) {
      alert(`Failed to cancel job: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    if (!window.confirm('Retry this failed job?')) return;
    
    try {
      await jobsAPI.retry(jobId);
      loadData();
      alert('Job retry initiated');
    } catch (error: any) {
      alert(`Failed to retry job: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
    
    try {
      await jobsAPI.delete(jobId);
      loadData();
      alert('Job deleted successfully');
    } catch (error: any) {
      alert(`Failed to delete job: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeleteAllJobs = async () => {
    const message = statusFilter 
      ? `Are you sure you want to delete all ${statusFilter} jobs? This action cannot be undone.`
      : 'Are you sure you want to delete all completed jobs (success, failed, cancelled)? This action cannot be undone.';
    
    if (!window.confirm(message)) return;
    
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (taskTypeFilter) params.task_type = taskTypeFilter;
      
      const response = await jobsAPI.deleteAll(params);
      loadData();
      alert(response.data.message || 'Jobs deleted successfully');
    } catch (error: any) {
      alert(`Failed to delete jobs: ${error.response?.data?.error || error.message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#6c757d';
      case 'running': return '#0d6efd';
      case 'success': return '#198754';
      case 'failed': return '#dc3545';
      case 'cancelled': return '#ffc107';
      default: return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '▶️';
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🚫';
      default: return '❓';
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (authLoading) {
    return <div style={{ padding: '20px' }}>Checking authentication...</div>;
  }

  if (!user?.is_admin) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Access Denied</h2>
        <p>This page is only accessible to administrators.</p>
        <button onClick={() => navigate('/')} style={{ padding: '10px 20px', marginTop: '20px' }}>
          Go Home
        </button>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading jobs...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Dashboard</button>
          <h1 style={{ margin: 0 }}>Job Management</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (3s)
          </label>
          <span>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        {/* Statistics Cards */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: getStatusColor('pending') }}>{stats.pending}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Pending</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: getStatusColor('running') }}>{stats.running}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Running</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: getStatusColor('success') }}>{stats.success}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Success</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: getStatusColor('failed') }}>{stats.failed}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Failed</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: getStatusColor('cancelled') }}>{stats.cancelled}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Cancelled</div>
            </div>
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#333' }}>{stats.total}</div>
              <div style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>Total</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 15px 0' }}>Filters</h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Status</label>
              <select 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="running">Running</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: '500' }}>Task Type</label>
              <select 
                value={taskTypeFilter} 
                onChange={(e) => setTaskTypeFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="">All</option>
                <option value="llm_analysis">LLM Analysis</option>
                <option value="file_upload">File Upload</option>
              </select>
            </div>
            <button 
              onClick={() => { setStatusFilter(''); setTaskTypeFilter(''); loadData(); }}
              style={{ marginTop: '24px', padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Filters
            </button>
            <button 
              onClick={handleDeleteAllJobs}
              style={{ marginTop: '24px', padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }}
            >
              Delete All {statusFilter ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) : 'Completed'} Jobs
            </button>
          </div>
        </div>

        {/* Jobs Table */}
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #ddd', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>ID</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Name</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Progress</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Created</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Duration</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                    No jobs found
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>{job.id}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        padding: '4px 12px', 
                        borderRadius: '12px', 
                        backgroundColor: getStatusColor(job.status) + '20',
                        color: getStatusColor(job.status),
                        fontSize: '13px',
                        fontWeight: '500'
                      }}>
                        {getStatusIcon(job.status)} {job.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {job.name || 'Unnamed Job'}
                      {job.current_step && job.status === 'running' && (
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{job.current_step}</div>
                      )}
                    </td>
                    <td style={{ padding: '12px' }}>
                      {job.status === 'running' || job.status === 'pending' ? (
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                            <span>{Math.round(job.progress)}%</span>
                            {job.total_steps && <span>{job.total_steps} steps</span>}
                          </div>
                          <div style={{ width: '100%', height: '8px', backgroundColor: '#e9ecef', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ 
                              width: `${job.progress}%`, 
                              height: '100%', 
                              backgroundColor: getStatusColor(job.status),
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '14px', color: '#666' }}>
                          {job.status === 'success' ? '100%' : job.status === 'failed' ? `${Math.round(job.progress)}%` : 'N/A'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px' }}>{job.task_type}</td>
                    <td style={{ padding: '12px', fontSize: '13px', color: '#666' }}>{formatDate(job.created_at)}</td>
                    <td style={{ padding: '12px', fontSize: '14px', fontFamily: 'monospace' }}>
                      {formatDuration(job.duration_seconds || job.running_seconds)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setSelectedJob(job)}
                          style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          View
                        </button>
                        {(job.status === 'pending' || job.status === 'running') && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        )}
                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#ffc107', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Retry
                          </button>
                        )}
                        {(job.status === 'success' || job.status === 'failed' || job.status === 'cancelled') && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
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
            zIndex: 1000
          }}
          onClick={() => setSelectedJob(null)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '30px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Job Details</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600', width: '40%' }}>ID</td>
                    <td style={{ padding: '12px 8px' }}>{selectedJob.id}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Task ID</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{selectedJob.task_id}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Status</td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ color: getStatusColor(selectedJob.status), fontWeight: '500' }}>
                        {getStatusIcon(selectedJob.status)} {selectedJob.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Name</td>
                    <td style={{ padding: '12px 8px' }}>{selectedJob.name}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Description</td>
                    <td style={{ padding: '12px 8px' }}>{selectedJob.description}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Progress</td>
                    <td style={{ padding: '12px 8px' }}>
                      {Math.round(selectedJob.progress)}%
                      {selectedJob.current_step && <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{selectedJob.current_step}</div>}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Created</td>
                    <td style={{ padding: '12px 8px' }}>{formatDate(selectedJob.created_at)}</td>
                  </tr>
                  {selectedJob.started_at && (
                    <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '600' }}>Started</td>
                      <td style={{ padding: '12px 8px' }}>{formatDate(selectedJob.started_at)}</td>
                    </tr>
                  )}
                  {selectedJob.completed_at && (
                    <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '600' }}>Completed</td>
                      <td style={{ padding: '12px 8px' }}>{formatDate(selectedJob.completed_at)}</td>
                    </tr>
                  )}
                  <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                    <td style={{ padding: '12px 8px', fontWeight: '600' }}>Duration</td>
                    <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                      {formatDuration(selectedJob.duration_seconds || selectedJob.running_seconds)}
                    </td>
                  </tr>
                  {selectedJob.error_message && (
                    <tr style={{ borderBottom: '1px solid #dee2e6' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', verticalAlign: 'top' }}>Error</td>
                      <td style={{ padding: '12px 8px' }}>
                        <pre style={{ 
                          margin: 0, 
                          padding: '12px', 
                          backgroundColor: '#f8d7da', 
                          border: '1px solid #f5c2c7',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#842029',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {selectedJob.error_message}
                        </pre>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedJob(null)}
                style={{ padding: '10px 24px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
