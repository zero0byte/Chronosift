import React, { useState, useEffect } from 'react';
import axios from '../lib/api';
import { enrichmentAPI } from '../lib/api';

interface IOC {
  id: number;
  ioc_type: string;
  value: string;
  confidence: 'low' | 'medium' | 'high' | 'confirmed';
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'investigating' | 'resolved' | 'false_positive';
  tags: string[];
  notes?: string;
  first_seen: string;
  enrichment_data?: Record<string, any>;
}

interface IOCStats {
  total: number;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
}

interface IOCManagementProps {
  projectId: number;
}

const IOCManagement: React.FC<IOCManagementProps> = ({ projectId }) => {
  const [iocs, setIocs] = useState<IOC[]>([]);
  const [stats, setStats] = useState<IOCStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIOCs, setSelectedIOCs] = useState<Set<number>>(new Set());
  const [expandedIOC, setExpandedIOC] = useState<number | null>(null);
  const [enrichingIOC, setEnrichingIOC] = useState<number | null>(null);
  
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const perPage = 50;

  useEffect(() => {
    fetchIOCs();
    fetchStats();
  }, [projectId, typeFilter, severityFilter, statusFilter, searchTerm, page]);

  const fetchIOCs = async () => {
    setLoading(true);
    try {
      const params: any = { page, per_page: perPage, include_enrichment: 'true' };
      if (typeFilter) params.type = typeFilter;
      if (severityFilter) params.severity = severityFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const response = await axios.get(`/iocs/projects/${projectId}/iocs`, { params });
      setIocs(response.data.iocs);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch IOCs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`/iocs/projects/${projectId}/iocs/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch IOC stats:', error);
    }
  };

  const handleDelete = async (iocId: number) => {
    if (!confirm('Delete this IOC?')) return;
    
    try {
      await axios.delete(`/iocs/iocs/${iocId}`);
      fetchIOCs();
      fetchStats();
    } catch (error) {
      alert('Failed to delete IOC');
    }
  };

  const handleBulkUpdate = async (updates: any) => {
    if (selectedIOCs.size === 0) {
      alert('No IOCs selected');
      return;
    }

    try {
      await axios.post(`/iocs/projects/${projectId}/iocs/bulk`, {
        ioc_ids: Array.from(selectedIOCs),
        updates
      });
      setSelectedIOCs(new Set());
      fetchIOCs();
      fetchStats();
    } catch (error) {
      alert('Failed to update IOCs');
    }
  };

  const handleEnrichIOC = async (ioc: IOC) => {
    setEnrichingIOC(ioc.id);
    try {
      // Map IOC type to enrichment entity type
      const entityTypeMap: Record<string, string> = {
        ipv4: 'ip',
        ipv6: 'ip',
        domain: 'domain',
        url: 'url',
        email: 'email',
        md5: 'hash',
        sha1: 'hash',
        sha256: 'hash'
      };

      const entityType = entityTypeMap[ioc.ioc_type];
      if (!entityType) {
        alert(`Enrichment not supported for ${ioc.ioc_type}`);
        return;
      }

      // Call enrichment API
      const response = await enrichmentAPI.enrichValue({
        entity_type: entityType,
        value: ioc.value
      });

      // Transform enrichment results into a format suitable for storage
      const enrichmentData: Record<string, any> = {};
      if (response.data.results && Array.isArray(response.data.results)) {
        response.data.results.forEach((result: any) => {
          const providerName = result.provider || 'unknown';
          enrichmentData[providerName] = result.data || result;
        });
      }

      // Update IOC with enrichment data
      await axios.put(`/iocs/iocs/${ioc.id}`, {
        enrichment_data: enrichmentData
      });

      // Refresh IOCs to show updated data
      await fetchIOCs();
      alert('Enrichment completed successfully!');
    } catch (error: any) {
      console.error('[IOC Enrichment] Error:', error);
      console.error('[IOC Enrichment] Error response:', error.response);
      alert(error.response?.data?.error || 'Failed to enrich IOC. Make sure API keys are configured in Settings.');
    } finally {
      setEnrichingIOC(null);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#0dcaf0',
      info: '#6c757d'
    };
    return { backgroundColor: colors[severity] || '#6c757d', color: '#fff', padding: '4px 8px', borderRadius: '3px', fontSize: '12px' };
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ marginTop: 0, marginBottom: '20px' }}>🛡️ IOC Management</h2>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
        <div style={{ padding: '15px', backgroundColor: '#e7f5ff', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Total IOCs</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff' }}>{stats?.total || 0}</div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#ffe5e5', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Critical</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>
            {stats?.by_severity?.critical || 0}
          </div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Active</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ffc107' }}>
            {stats?.by_status?.active || 0}
          </div>
        </div>
        <div style={{ padding: '15px', backgroundColor: '#d4edda', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ fontSize: '12px', color: '#666' }}>Resolved</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>
            {stats?.by_status?.resolved || 0}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search IOCs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: '1 1 250px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
        />
        
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <option value="">All Types</option>
          <option value="ipv4">IPv4</option>
          <option value="domain">Domain</option>
          <option value="url">URL</option>
          <option value="email">Email</option>
          <option value="md5">MD5</option>
          <option value="sha1">SHA1</option>
          <option value="sha256">SHA256</option>
          <option value="cve">CVE</option>
        </select>

        <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <option value="">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="false_positive">False Positive</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIOCs.size > 0 && (
        <div style={{ padding: '10px', backgroundColor: '#e7f5ff', border: '1px solid #007bff', borderRadius: '4px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selectedIOCs.size} selected</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => handleBulkUpdate({ status: 'investigating' })} style={{ padding: '6px 12px', backgroundColor: '#ffc107', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Investigating
            </button>
            <button onClick={() => handleBulkUpdate({ status: 'resolved' })} style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Resolved
            </button>
            <button onClick={() => handleBulkUpdate({ status: 'false_positive' })} style={{ padding: '6px 12px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              False Positive
            </button>
          </div>
        </div>
      )}

      {/* IOC Table */}
      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading...</div>
        ) : iocs.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>🛡️</div>
            <div>No IOCs found</div>
            <div style={{ fontSize: '14px', marginTop: '10px' }}>Extract IOCs from timeline entries to get started</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>
                  <input
                    type="checkbox"
                    checked={selectedIOCs.size === iocs.length}
                    onChange={() => {
                      if (selectedIOCs.size === iocs.length) {
                        setSelectedIOCs(new Set());
                      } else {
                        setSelectedIOCs(new Set(iocs.map(i => i.id)));
                      }
                    }}
                  />
                </th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Value</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Severity</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {iocs.map((ioc) => (
                <React.Fragment key={ioc.id}>
                  <tr style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIOCs.has(ioc.id)}
                        onChange={() => {
                          const newSet = new Set(selectedIOCs);
                          if (newSet.has(ioc.id)) newSet.delete(ioc.id);
                          else newSet.add(ioc.id);
                          setSelectedIOCs(newSet);
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{ioc.value}</div>
                      {ioc.tags.length > 0 && (
                        <div style={{ marginTop: '4px' }}>
                          {ioc.tags.map((tag, i) => (
                            <span key={i} style={{ display: 'inline-block', padding: '2px 6px', marginRight: '4px', backgroundColor: '#e7f5ff', color: '#007bff', borderRadius: '3px', fontSize: '11px' }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', textTransform: 'uppercase', fontSize: '12px', color: '#666' }}>{ioc.ioc_type}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={getSeverityBadge(ioc.severity)}>{ioc.severity}</span>
                    </td>
                    <td style={{ padding: '10px', textTransform: 'capitalize' }}>{ioc.status.replace('_', ' ')}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => setExpandedIOC(expandedIOC === ioc.id ? null : ioc.id)} style={{ padding: '4px 8px', marginRight: '8px', cursor: 'pointer' }}>
                        {expandedIOC === ioc.id ? '▲' : '▼'}
                      </button>
                      <button onClick={() => handleDelete(ioc.id)} style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  {expandedIOC === ioc.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '15px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                        <div style={{ marginBottom: '15px' }}>
                          <div style={{ marginBottom: '8px' }}><strong>Confidence:</strong> {ioc.confidence}</div>
                          <div style={{ marginBottom: '8px' }}><strong>First Seen:</strong> {new Date(ioc.first_seen).toLocaleString()}</div>
                          {ioc.notes && <div style={{ marginBottom: '8px' }}><strong>Notes:</strong> {ioc.notes}</div>}
                          
                          {/* Enrich Button */}
                          <button
                            onClick={() => handleEnrichIOC(ioc)}
                            disabled={enrichingIOC === ioc.id}
                            style={{
                              padding: '8px 16px',
                              marginTop: '10px',
                              backgroundColor: enrichingIOC === ioc.id ? '#9333ea80' : '#9333ea',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: enrichingIOC === ioc.id ? 'not-allowed' : 'pointer',
                              fontSize: '14px'
                            }}
                          >
                            {enrichingIOC === ioc.id ? '⏳ Enriching...' : '✨ Enrich IOC'}
                          </button>
                        </div>

                        {/* Enrichment Data */}
                        {ioc.enrichment_data && Object.keys(ioc.enrichment_data).length > 0 && (
                          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#495057' }}>🔍 Enrichment Data</div>
                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                              {Object.entries(ioc.enrichment_data).map(([provider, data]: [string, any]) => (
                                <div key={provider} style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                                  <div style={{ fontWeight: '600', marginBottom: '8px', color: '#007bff', textTransform: 'capitalize' }}>
                                    {provider}
                                  </div>
                                  {typeof data === 'object' && data !== null ? (
                                    <div style={{ fontSize: '13px' }}>
                                      {Object.entries(data).map(([key, value]: [string, any]) => (
                                        <div key={key} style={{ marginBottom: '4px' }}>
                                          <strong>{key.replace(/_/g, ' ')}:</strong>{' '}
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '13px' }}>{String(data)}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > perPage && (
        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', color: '#666' }}>
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setPage(page - 1)} disabled={page === 1} style={{ padding: '6px 12px', cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.5 : 1 }}>
              Previous
            </button>
            <button onClick={() => setPage(page + 1)} disabled={page * perPage >= total} style={{ padding: '6px 12px', cursor: page * perPage >= total ? 'not-allowed' : 'pointer', opacity: page * perPage >= total ? 0.5 : 1 }}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default IOCManagement;
