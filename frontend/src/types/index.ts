export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  created_by: number;
  created_at: string;
  updated_at: string;
  members?: TeamMember[];
  member_count?: number;
}

export interface TeamMember {
  id: number;
  team_id: number;
  user_id: number;
  role: 'admin' | 'member';
  user: User;
  joined_at: string;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  team_id: number;
  created_by: number;
  status: 'active' | 'archived' | 'closed';
  created_at: string;
  updated_at: string;
  members?: ProjectMember[];
  timeline_count?: number;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  permissions: 'read' | 'write' | 'admin';
  user: User;
  joined_at: string;
}

export interface Timeline {
  id: number;
  name: string;
  description?: string;
  project_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  entry_count: number;
  columns?: ColumnDefinition[];
  is_master?: boolean;
}

export interface ColumnDefinition {
  id: number;
  timeline_id: number;
  name: string;
  column_type: 'timestamp' | 'text' | 'number' | 'tags' | 'multiselect' | 'boolean' | 'label' | 'ip_address' | 'hash' | 'url' | 'duration' | 'json';
  config: Record<string, any>; // For label type: { options: [{ value: string, label: string, color: string }] }, for hash: { hash_type: 'md5' | 'sha1' | 'sha256' | 'auto' }
  order: number;
  is_required: boolean;
  is_searchable: boolean;
  created_at: string;
}

export interface LabelOption {
  value: string;
  label: string;
  color: string; // hex color code
}

export interface TimelineEntry {
  id: number;
  timeline_id: number;
  data: Record<string, any>;
  created_by: number;
  created_at: string;
  updated_at: string;
  analysis?: TimelineAnalysisResult; // Optional, populated when analysis is available
}

export interface Transform {
  id: number;
  name: string;
  description?: string;
  input_format: 'csv' | 'json' | 'xml';
  mapping: Record<string, any>;
  created_by: number;
  team_id?: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

// LLM Analysis Types
export interface MitreTactic {
  id: string; // e.g., "TA0001"
  name: string;
  description?: string;
  url?: string;
}

export interface MitreTechnique {
  id: string; // e.g., "T1566"
  tactic_id: string;
  name: string;
  description?: string;
  detection?: string;
  platforms?: string[];
  data_sources?: string[];
  url?: string;
  is_subtechnique: boolean;
  parent_technique_id?: string;
  subtechniques?: MitreTechnique[];
}

export interface TimelineAnalysisResult {
  id: number;
  timeline_id: number;
  entry_id?: number;
  analysis_type: 'prioritization' | 'attack_mapping' | 'chain_detection';
  priority_score?: number;
  confidence_score?: number;
  mitre_technique?: MitreTechnique;
  mitre_tactic?: MitreTactic;
  llm_provider: string;
  llm_model: string;
  explanation?: string;
  analyzed_by?: number;
  created_at: string;
}

export interface AttackChainDetection {
  name: string;
  description: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  events: number[];
  tactics_sequence: string[];
  indicators: string[];
}

export interface TrainingDataset {
  id: number;
  name: string;
  description?: string;
  version?: string;
  total_examples: number;
  source_timelines: number[];
  dataset_format: 'jsonl' | 'csv' | 'parquet';
  file_path?: string;
  validated_examples: number;
  avg_confidence_score?: number;
  created_by: number;
  created_at: string;
}

export interface TrainingExample {
  id: number;
  dataset_id: number;
  timeline_id?: number;
  entry_id?: number;
  input_text: string;
  output_text: string;
  mitre_technique?: MitreTechnique;
  mitre_tactic?: MitreTactic;
  priority_score?: number;
  is_validated: boolean;
  validated_by?: number;
  validation_notes?: string;
  confidence_score?: number;
  created_at: string;
}

export interface LLMStatus {
  providers: string[];
  default_provider: string;
  configured: boolean;
}

export interface MitreStats {
  total_tactics: number;
  total_techniques: number;
  total_subtechniques: number;
  techniques_with_detection: number;
}

export interface Job {
  id: number;
  task_id: string;
  task_type: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  name?: string;
  description?: string;
  progress: number;
  current_step?: string;
  total_steps?: number;
  user_id: number;
  timeline_id?: number;
  project_id?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  running_seconds?: number;
  input_data?: any;
  result_data?: any;
  error_message?: string;
}

export interface JobStats {
  pending: number;
  running: number;
  success: number;
  failed: number;
  cancelled: number;
  total: number;
}
