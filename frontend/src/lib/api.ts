import axios from 'axios';

// Determine API URL dynamically
// Priority:
// 1. VITE_API_URL environment variable (for custom deployments)
// 2. Relative '/api' if accessed via port 80/443 (nginx proxy)
// 3. Same hostname:5000 if accessed via IP or domain on non-standard port
// 4. 'http://localhost:5000/api' (fallback for local development)
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  const { protocol, hostname, port } = window.location;
  
  // If accessed on standard HTTP/HTTPS ports, assume nginx proxy
  if (port === '' || port === '80' || port === '443') {
    return '/api';
  }
  
  // If on port 3000 (frontend port), use port 5000 (backend port)
  if (port === '3000') {
    return `${protocol}//${hostname}:5000/api`;
  }
  
  // Fallback
  return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't try to refresh if this was the refresh endpoint itself
    if (originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error);
    }

    // Don't try to refresh on server errors (5xx) - these are backend issues, not auth issues
    if (error.response?.status >= 500) {
      return Promise.reject(error);
    }

    // If 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        // No refresh token, just reject - don't redirect
        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          headers: {
            Authorization: `Bearer ${refreshToken}`,
          },
        });

        const { access_token } = response.data;
        localStorage.setItem('access_token', access_token);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (refreshError: any) {
        // Don't auto-logout - just reject the error
        // Let the user manually logout if needed
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (data: { email: string; password: string; first_name?: string; last_name?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  getCurrentUser: () =>
    api.get('/auth/me'),
  refresh: () =>
    api.post('/auth/refresh'),
};

// Team endpoints
export const teamAPI = {
  create: (data: { name: string; description?: string }) =>
    api.post('/teams', data),
  list: () =>
    api.get('/teams'),
  get: (id: number) =>
    api.get(`/teams/${id}`),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.put(`/teams/${id}`, data),
  delete: (id: number) =>
    api.delete(`/teams/${id}`),
  addMember: (teamId: number, data: { user_id: number; role?: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId: number, userId: number, data: { role: string }) =>
    api.put(`/teams/${teamId}/members/${userId}`, data),
  removeMember: (teamId: number, userId: number) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

// Project endpoints
export const projectAPI = {
  create: (data: { name: string; team_id: number; description?: string; status?: string }) =>
    api.post('/projects', data),
  list: (teamId?: number) =>
    api.get('/projects', { params: teamId ? { team_id: teamId } : {} }),
  get: (id: number) =>
    api.get(`/projects/${id}`),
  update: (id: number, data: { name?: string; description?: string; status?: string }) =>
    api.put(`/projects/${id}`, data),
  delete: (id: number) =>
    api.delete(`/projects/${id}`),
  addMember: (projectId: number, data: { user_id: number; permissions?: string }) =>
    api.post(`/projects/${projectId}/members`, data),
  updateMember: (projectId: number, userId: number, data: { permissions: string }) =>
    api.put(`/projects/${projectId}/members/${userId}`, data),
  removeMember: (projectId: number, userId: number) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
  listTimelines: (projectId: number) =>
    api.get(`/projects/${projectId}/timelines`),
  search: (projectId: number, params: { keyword?: string; start_date?: string; end_date?: string; timeline_ids?: number[]; limit?: number; offset?: number }) =>
    api.get(`/projects/${projectId}/search`, { params }),
};

// User endpoints
export const userAPI = {
  list: () =>
    api.get('/users'),
  get: (id: number) =>
    api.get(`/users/${id}`),
  update: (id: number, data: { first_name?: string; last_name?: string }) =>
    api.put(`/users/${id}`, data),
};

// Timeline endpoints
export const timelineAPI = {
  create: (data: { name: string; project_id: number; description?: string; columns?: any[] }) =>
    api.post('/timelines', data),
  get: (id: number, includeEntries?: boolean) =>
    api.get(`/timelines/${id}`, { params: includeEntries ? { include_entries: 'true' } : {} }),
  update: (id: number, data: { name?: string; description?: string }) =>
    api.put(`/timelines/${id}`, data),
  delete: (id: number) =>
    api.delete(`/timelines/${id}`),
  
  // Column management
  addColumn: (timelineId: number, data: { name: string; column_type: string; config?: any; is_required?: boolean; is_searchable?: boolean }) =>
    api.post(`/timelines/${timelineId}/columns`, data),
  updateColumn: (timelineId: number, columnId: number, data: any) =>
    api.put(`/timelines/${timelineId}/columns/${columnId}`, data),
  deleteColumn: (timelineId: number, columnId: number) =>
    api.delete(`/timelines/${timelineId}/columns/${columnId}`),
  
  // Entry management
  listEntries: (timelineId: number, page?: number, perPage?: number) =>
    api.get(`/timelines/${timelineId}/entries`, { params: { page, per_page: perPage } }),
  createEntry: (timelineId: number, data: any) =>
    api.post(`/timelines/${timelineId}/entries`, { data }),
  createEntriesBulk: (timelineId: number, entries: any[]) =>
    api.post(`/timelines/${timelineId}/entries/bulk`, { entries }),
  getEntry: (timelineId: number, entryId: number) =>
    api.get(`/timelines/${timelineId}/entries/${entryId}`),
  updateEntry: (timelineId: number, entryId: number, data: any) =>
    api.put(`/timelines/${timelineId}/entries/${entryId}`, { data }),
  deleteEntry: (timelineId: number, entryId: number) =>
    api.delete(`/timelines/${timelineId}/entries/${entryId}`),
  
  // Search
  search: (timelineId: number, query: string, page?: number, perPage?: number, opts?: { field?: string; filter?: any; sort_by?: string; sort_dir?: 'asc' | 'desc' }) => {
    const filterString = opts?.filter ? JSON.stringify(opts.filter) : undefined;
    return api.get(`/timelines/${timelineId}/search`, { params: { q: query, page, per_page: perPage, ...(opts?.field ? { field: opts.field } : {}), ...(opts?.filter ? { filter: filterString } : {}), ...(opts?.sort_by ? { sort_by: opts.sort_by, sort_dir: opts.sort_dir || 'asc' } : {}) } });
  },
  
  // Get entries around a timestamp
  getEntriesAroundTimestamp: (timelineId: number, timestamp: string, timestampColumn: string, limit?: number) =>
    api.get(`/timelines/${timelineId}/entries/around-timestamp`, { 
      params: { 
        timestamp, 
        timestamp_column: timestampColumn, 
        limit: limit || 50 
      } 
    }),
  
  // Promote entries to master timeline
  promote: (timelineId: number, entryIds: number[]) =>
    api.post(`/timelines/${timelineId}/entries/promote`, { entry_ids: entryIds }),
};

// Transforms endpoints
export const transformAPI = {
  list: () => api.get('/transforms'),
  create: (data: { name: string; input_format: 'csv'|'json'|'xml'; mapping: any; description?: string; is_public?: boolean; team_id?: number }) => api.post('/transforms', data),
  get: (id: number) => api.get(`/transforms/${id}`),
  update: (id: number, data: any) => api.put(`/transforms/${id}`, data),
  delete: (id: number) => api.delete(`/transforms/${id}`),
  test: (id: number, sample_data: string) => api.post(`/transforms/${id}/test`, { sample_data }),
  testInline: (input_format: string, mapping: any, sample_data: string) => api.post('/transforms/test', { input_format, mapping, sample_data }),
};

// Uploads endpoints
export const uploadAPI = {
  uploadFile: (form: FormData) => api.post('/upload', form, { 
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000, // 10 minutes for large file uploads
  }),
  processInline: (data: { content: string; timeline_id: number; transform_id: number }) => api.post('/upload/process', data),
  status: (taskId: string) => api.get(`/upload/status/${taskId}`),
};

// Saved Views endpoints
export const viewsAPI = {
  listForTimeline: (timelineId: number) => api.get(`/views/timeline/${timelineId}`),
  create: (data: { timeline_id: number; name: string; description?: string; is_pinned?: boolean; is_shared?: boolean; filter_config?: any; sort_config?: any; visible_columns?: string[]; column_widths?: Record<string, number> }) => api.post('/views', data),
  get: (id: number) => api.get(`/views/${id}`),
  update: (id: number, data: any) => api.put(`/views/${id}`, data),
  delete: (id: number) => api.delete(`/views/${id}`),
  togglePin: (id: number) => api.put(`/views/${id}/pin`),
};

// Enrichment endpoints
export const enrichmentAPI = {
  // Providers
  listProviders: (entityType?: string) => api.get('/enrichment/providers', { params: entityType ? { entity_type: entityType } : {} }),
  
  // API Keys
  listAPIKeys: () => api.get('/enrichment/api-keys'),
  addAPIKey: (data: { provider_id: number; api_key: string; key_name?: string }) => api.post('/enrichment/api-keys', data),
  deleteAPIKey: (keyId: number) => api.delete(`/enrichment/api-keys/${keyId}`),
  
  // Entity extraction and enrichment
  extractEntities: (entryId: number) => api.post(`/enrichment/extract/${entryId}`),
  enrichValue: (data: { entity_type: string; value: string; providers?: string[] }) => api.post('/enrichment/enrich', data),
  enrichEntity: (entityId: number, providers?: string[]) => api.post(`/enrichment/enrich/${entityId}`, providers ? { providers } : {}),
  getEntryEntities: (entryId: number) => api.get(`/enrichment/entities/${entryId}`),
};

// Saved Queries endpoints
export const savedQueriesAPI = {
  listForTimeline: (timelineId: number) => api.get(`/timelines/${timelineId}/saved-queries`),
  create: (timelineId: number, data: { name: string; description?: string; query_config: any; is_shared?: boolean; is_pinned?: boolean }) => api.post(`/timelines/${timelineId}/saved-queries`, data),
  get: (queryId: number) => api.get(`/saved-queries/${queryId}`),
  update: (queryId: number, data: any) => api.put(`/saved-queries/${queryId}`, data),
  delete: (queryId: number) => api.delete(`/saved-queries/${queryId}`),
  togglePin: (queryId: number, isPinned: boolean) => api.post(`/saved-queries/${queryId}/pin`, { is_pinned: isPinned }),
};

// Comments endpoints
export const commentsAPI = {
  getEntryComments: (entryId: number) => api.get(`/comments/entry/${entryId}`),
  createComment: (entryId: number, data: { content: string; parent_id?: number }) => api.post(`/comments/entry/${entryId}`, data),
  updateComment: (commentId: number, data: { content: string }) => api.put(`/comments/${commentId}`, data),
  deleteComment: (commentId: number) => api.delete(`/comments/${commentId}`),
  getMentions: (unreadOnly?: boolean, page?: number, perPage?: number) => api.get('/comments/mentions', { params: { unread_only: unreadOnly, page, per_page: perPage } }),
  markMentionRead: (mentionId: number) => api.put(`/comments/mentions/${mentionId}/read`),
  markAllMentionsRead: () => api.put('/comments/mentions/read-all'),
};

// Activities endpoints
export const activitiesAPI = {
  getProjectActivities: (projectId: number, page?: number, perPage?: number, type?: string) => 
    api.get(`/activities/project/${projectId}`, { params: { page, per_page: perPage, type } }),
  getUserActivities: (page?: number, perPage?: number, type?: string) => 
    api.get('/activities/user', { params: { page, per_page: perPage, type } }),
};

// Reports endpoints
export const reportsAPI = {
  // Report Templates
  createTemplate: (data: { name: string; description?: string; project_id: number; template_content: string; config?: any; is_public?: boolean; category?: string }) =>
    api.post('/reports/templates', data),
  getTemplate: (templateId: number) => api.get(`/reports/templates/${templateId}`),
  listTemplates: (projectId: number) => api.get(`/reports/projects/${projectId}/templates`),
  updateTemplate: (templateId: number, data: any) => api.put(`/reports/templates/${templateId}`, data),
  deleteTemplate: (templateId: number) => api.delete(`/reports/templates/${templateId}`),
  
  // Report Generation
  generateReport: (data: { template_id: number; project_id: number; timeline_id?: number; start_date?: string; end_date?: string; entry_limit?: number; filters?: any; name?: string; description?: string; format?: string }) =>
    api.post('/reports/generate', data),
  generateAI: (data: { project_id: number; timeline_id?: number; name?: string; description?: string; model_preference?: string }) =>
    api.post('/reports/generate-ai', data),
  listReports: (projectId: number) => api.get(`/reports/projects/${projectId}/reports`),
  getReport: (reportId: number, includeContent?: boolean) => api.get(`/reports/reports/${reportId}`, { params: includeContent ? { include_content: 'true' } : {} }),
  deleteReport: (reportId: number) => api.delete(`/reports/reports/${reportId}`),
  downloadReport: (reportId: number) => {
    const token = localStorage.getItem('access_token');
    return fetch(`${API_URL}/reports/reports/${reportId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.blob());
  },
};

// Key Timestamps endpoints
export const keyTimestampsAPI = {
  // List all key timestamps for a project
  list: (projectId: number) => 
    api.get(`/projects/${projectId}/key-timestamps`),
  
  // Create a new key timestamp
  create: (projectId: number, data: { timestamp: string; label: string; description?: string; color?: string }) => 
    api.post(`/projects/${projectId}/key-timestamps`, data),
  
  // Update a key timestamp
  update: (timestampId: number, data: { timestamp?: string; label?: string; description?: string; color?: string }) => 
    api.put(`/key-timestamps/${timestampId}`, data),
  
  // Delete a key timestamp
  delete: (timestampId: number) => 
    api.delete(`/key-timestamps/${timestampId}`),
  
  // Search around a key timestamp
  searchAround: (projectId: number, timestampId: number, params?: { timeline_ids?: string; window_minutes?: number; limit?: number }) => 
    api.get(`/projects/${projectId}/key-timestamps/${timestampId}/search`, { params }),
  
  // Search around multiple timestamps
  searchMultiple: (projectId: number, data: { timestamp_ids: number[]; window_minutes?: number; timeline_ids?: number[]; limit_per_timestamp?: number }) => 
    api.post(`/projects/${projectId}/key-timestamps/search-multiple`, data),
};

// Attack Chains endpoints
export const attackChainsAPI = {
  // List all attack chains for a project
  list: (projectId: number) => 
    api.get(`/projects/${projectId}/attack-chains`),
  
  // Create a new attack chain
  create: (projectId: number, data: { name: string; description?: string }) => 
    api.post(`/projects/${projectId}/attack-chains`, data),
  
  // Get attack chain with full data
  get: (chainId: number) => 
    api.get(`/attack-chains/${chainId}`),
  
  // Update attack chain metadata
  update: (chainId: number, data: { name?: string; description?: string }) => 
    api.put(`/attack-chains/${chainId}`, data),
  
  // Delete attack chain
  delete: (chainId: number) => 
    api.delete(`/attack-chains/${chainId}`),
  
  // Add node to chain
  addNode: (chainId: number, data: { key_timestamp_id: number; x_position?: number; y_position?: number; mitre_tactic?: string; mitre_technique?: string; mitre_subtechnique?: string; notes?: string; severity?: string }) => 
    api.post(`/attack-chains/${chainId}/nodes`, data),
  
  // Update node
  updateNode: (nodeId: number, data: { x_position?: number; y_position?: number; mitre_tactic?: string; mitre_technique?: string; mitre_subtechnique?: string; notes?: string; severity?: string; order?: number }) => 
    api.put(`/attack-chain-nodes/${nodeId}`, data),
  
  // Delete node
  deleteNode: (nodeId: number) => 
    api.delete(`/attack-chain-nodes/${nodeId}`),
  
  // Add edge between nodes
  addEdge: (chainId: number, data: { from_node_id: number; to_node_id: number; relationship_type?: string; label?: string; confidence?: string }) => 
    api.post(`/attack-chains/${chainId}/edges`, data),
  
  // Update edge
  updateEdge: (edgeId: number, data: { relationship_type?: string; label?: string; confidence?: string }) => 
    api.put(`/attack-chain-edges/${edgeId}`, data),
  
  // Delete edge
  deleteEdge: (edgeId: number) => 
    api.delete(`/attack-chain-edges/${edgeId}`),
  
  // Export as MITRE Navigator layer
  exportMitreNavigator: (chainId: number) => 
    api.get(`/attack-chains/${chainId}/export/mitre-navigator`),
};

// Entry Links endpoints
export const entryLinksAPI = {
  // List all links for a timeline entry (incoming and outgoing)
  listForEntry: (entryId: number) => 
    api.get(`/timeline-entries/${entryId}/links`),
  
  // Create a new link between entries
  create: (data: { from_entry_id: number; to_entry_id: number; link_type: string; description?: string }) => 
    api.post('/entry-links', data),
  
  // Create multiple links from one entry to multiple entries
  createBulk: (data: { from_entry_id: number; to_entry_ids: number[]; link_type: string; description?: string }) => 
    api.post('/entry-links/bulk', data),
  
  // Get a specific link
  get: (linkId: number) => 
    api.get(`/entry-links/${linkId}`),
  
  // Update a link
  update: (linkId: number, data: { link_type?: string; description?: string }) => 
    api.put(`/entry-links/${linkId}`, data),
  
  // Delete a link
  delete: (linkId: number) => 
    api.delete(`/entry-links/${linkId}`),
  
  // List all entry links in a project
  listForProject: (projectId: number) => 
    api.get(`/projects/${projectId}/entry-links`),
};

// LLM Analysis endpoints
export const llmAPI = {
  // Get LLM status
  getStatus: () => 
    api.get('/llm/status'),
  
  // Analyze timeline (batch priority + attack mapping + chain detection)
  analyzeTimeline: (timelineId: number, options?: { analyze_priority?: boolean; analyze_attack?: boolean; detect_chains?: boolean; entry_limit?: number }) => 
    api.post(`/llm/analysis/timeline/${timelineId}/batch`, options || {}),
  
  // Get analysis results for timeline
  getAnalysis: (timelineId: number, analysisType?: string) => 
    api.get(`/llm/analysis/timeline/${timelineId}/results`, { params: { type: analysisType } }),
  
  // Detect attack chains in timeline (detection only)
  detectChains: (timelineId: number) => 
    api.post(`/llm/analysis/timeline/${timelineId}/chains`),
  
  // Detect and create attack chains (synchronous)
  detectAndCreateChains: (timelineId: number, options?: { context?: string; min_confidence?: number }) => 
    api.post(`/llm/analysis/timeline/${timelineId}/detect-and-create-chains`, options || {}),
  
  // Detect and create attack chains (asynchronous via job)
  detectAndCreateChainsAsync: (timelineId: number, options?: { context?: string; min_confidence?: number }) => 
    api.post(`/llm/analysis/timeline/${timelineId}/detect-and-create-chains-async`, options || {}),
  
  // Get entry analysis results
  getEventAnalysis: (entryId: number) => 
    api.get(`/llm/analysis/entry/${entryId}/results`),
  
  // Analyze single entry priority
  analyzeEntryPriority: (entryId: number, context?: string) => 
    api.post(`/llm/analysis/entry/${entryId}/priority`, { context }),
  
  // Map entry to MITRE ATT&CK
  analyzeEntryAttack: (entryId: number, context?: string) => 
    api.post(`/llm/analysis/entry/${entryId}/attack`, { context }),
};

// MITRE ATT&CK endpoints
export const mitreAPI = {
  // Load MITRE ATT&CK data
  loadData: () => 
    api.post('/llm/mitre/load'),
  
  // Get statistics
  getStats: () => 
    api.get('/llm/mitre/stats'),
  
  // List tactics
  listTactics: () => 
    api.get('/llm/mitre/tactics'),
  
  // Get tactic details
  getTactic: (tacticId: string) => 
    api.get(`/llm/mitre/tactics/${tacticId}`),
  
  // List techniques (with optional filters)
  listTechniques: (params?: { tactic_id?: string; search?: string }) => 
    api.get('/llm/mitre/techniques', { params }),
  
  // Get technique details
  getTechnique: (techniqueId: string) => 
    api.get(`/llm/mitre/techniques/${techniqueId}`),
  
  // Search techniques
  searchTechniques: (query: string) => 
    api.get('/llm/mitre/techniques/search', { params: { q: query } }),
};

// Training Dataset endpoints
export const datasetAPI = {
  // List datasets
  list: (params?: { dataset_type?: string; is_validated?: boolean }) => 
    api.get('/llm/datasets', { params }),
  
  // Get dataset
  get: (datasetId: number) => 
    api.get(`/llm/datasets/${datasetId}`),
  
  // Create dataset
  create: (data: { name: string; description?: string; dataset_type: string }) => 
    api.post('/llm/datasets', data),
  
  // Update dataset
  update: (datasetId: number, data: { name?: string; description?: string; is_validated?: boolean }) => 
    api.put(`/llm/datasets/${datasetId}`, data),
  
  // Delete dataset
  delete: (datasetId: number) => 
    api.delete(`/llm/datasets/${datasetId}`),
  
  // List examples in dataset
  listExamples: (datasetId: number, params?: { is_validated?: boolean }) => 
    api.get(`/llm/datasets/${datasetId}/examples`, { params }),
  
  // Get example
  getExample: (exampleId: number) => 
    api.get(`/llm/examples/${exampleId}`),
  
  // Add example to dataset
  addExample: (datasetId: number, data: { input_data: any; expected_output: any; metadata?: any }) => 
    api.post(`/llm/datasets/${datasetId}/examples`, data),
  
  // Update example
  updateExample: (exampleId: number, data: { input_data?: any; expected_output?: any; metadata?: any; is_validated?: boolean }) => 
    api.put(`/llm/examples/${exampleId}`, data),
  
  // Delete example
  deleteExample: (exampleId: number) => 
    api.delete(`/llm/examples/${exampleId}`),
  
  // Validate example
  validateExample: (exampleId: number, isValid: boolean, notes?: string) => 
    api.post(`/llm/examples/${exampleId}/validate`, { is_validated: isValid, metadata: { validation_notes: notes } }),
  
  // Export dataset
  export: (datasetId: number, format: 'json' | 'csv' = 'json') => 
    api.get(`/llm/datasets/${datasetId}/export`, { params: { format } }),
  
  // Generate training data from timeline
  generateFromTimeline: (timelineId: number, datasetId?: number) => 
    api.post('/llm/datasets/generate', { timeline_id: timelineId, dataset_id: datasetId }),
};

// Job Management endpoints
export const jobsAPI = {
  // List jobs with optional filters
  list: (params?: { status?: string; task_type?: string; timeline_id?: number; project_id?: number; user_id?: number; limit?: number }) => 
    api.get('/jobs', { params }),
  
  // Get specific job details
  get: (jobId: number) => 
    api.get(`/jobs/${jobId}`),
  
  // Cancel a running job
  cancel: (jobId: number) => 
    api.post(`/jobs/${jobId}/cancel`),
  
  // Retry a failed job
  retry: (jobId: number) => 
    api.post(`/jobs/${jobId}/retry`),
  
  // Delete a specific job
  delete: (jobId: number) => 
    api.delete(`/jobs/${jobId}`),
  
  // Delete all completed jobs (with optional filters)
  deleteAll: (params?: { status?: string; task_type?: string }) => 
    api.delete('/jobs/delete-all', { params }),
  
  // Get job statistics
  getStats: () => 
    api.get('/jobs/stats'),
  
  // Get active jobs only
  getActive: () => 
    api.get('/jobs/active'),
};

// Prompt Management endpoints
export const promptAPI = {
  // List all prompts
  list: (params?: { type?: string; include_inactive?: boolean }) =>
    api.get('/llm/prompts', { params }),
  
  // Get a specific prompt
  get: (promptId: number) =>
    api.get(`/llm/prompts/${promptId}`),
  
  // Get active prompt for a specific type
  getActive: (promptType: 'priority' | 'attack' | 'chains') =>
    api.get(`/llm/prompts/active/${promptType}`),
  
  // Create a new custom prompt
  create: (data: {
    prompt_type: 'priority' | 'attack' | 'chains';
    name: string;
    description?: string;
    system_prompt: string;
    user_prompt_template?: string;
    is_active?: boolean;
  }) =>
    api.post('/llm/prompts', data),
  
  // Update an existing prompt
  update: (promptId: number, data: {
    name?: string;
    description?: string;
    system_prompt?: string;
    user_prompt_template?: string;
    is_active?: boolean;
  }) =>
    api.put(`/llm/prompts/${promptId}`, data),
  
  // Delete a custom prompt
  delete: (promptId: number) =>
    api.delete(`/llm/prompts/${promptId}`),
  
  // Reset to default prompt
  resetToDefault: (promptId: number) =>
    api.post(`/llm/prompts/${promptId}/reset-to-default`),
};

export default api;
