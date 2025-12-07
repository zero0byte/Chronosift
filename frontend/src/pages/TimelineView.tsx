import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useWebSocket } from '../lib/WebSocketContext';
import { timelineAPI, transformAPI, uploadAPI, keyTimestampsAPI, llmAPI, jobsAPI } from '../lib/api';
import { Timeline, TimelineEntry } from '../types';
import CommentSection from '../components/CommentSection';
import ActivityFeed from '../components/ActivityFeed';
import NotificationBell from '../components/NotificationBell';
import TimelineTable from '../components/TimelineTable';
import ColumnManager from '../components/ColumnManager';
import FileUploader from '../components/FileUploader';
import FilterPanel from '../components/FilterPanel';
import AdvancedFilterPanel from '../components/AdvancedFilterPanel';
import SavedViews from '../components/SavedViews';
import SavedQueries from '../components/SavedQueries';
import TimelineChart from '../components/TimelineChart';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';
import ColumnVisibilityToggle from '../components/ColumnVisibilityToggle';
import EnhancedTimelineTable, { useTableEnhancements } from '../components/EnhancedTimelineTable';
import GanttTimelineView from '../components/GanttTimelineView';
import EventClusterView from '../components/EventClusterView';
import ActivityHeatmap from '../components/ActivityHeatmap';
import EntityEnrichment from '../components/EntityEnrichment';
import IOCExtractor from '../components/IOCExtractor';
import TimePivot from '../components/TimePivot';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export default function TimelineView() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [allEntries, setAllEntries] = useState<TimelineEntry[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any>({});
  const [viewMode, setViewMode] = useState<'table' | 'chart' | 'gantt' | 'clusters' | 'heatmap'>('table');
  const [showHelp, setShowHelp] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Manual input modal state
  const [showManualInput, setShowManualInput] = useState(false);
  const [transforms, setTransforms] = useState<any[]>([]);
  const [selectedTransform, setSelectedTransform] = useState<number | null>(null);
  const [manualData, setManualData] = useState('');
  const [validationPreview, setValidationPreview] = useState<any[] | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  
  // Enrichment state
  const [showEnrichment, setShowEnrichment] = useState(false);
  const [enrichmentEntry, setEnrichmentEntry] = useState<TimelineEntry | null>(null);
  
  // Comments and activity state
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const { joinProject, leaveProject } = useWebSocket();
  
  // Saved queries state
  const [pendingQueryConfig, setPendingQueryConfig] = useState<any>(null);
  const [activeQueryConfig, setActiveQueryConfig] = useState<any>(null);
  
  // Time pivot state
  const [showTimePivot, setShowTimePivot] = useState(false);
  const [pivotEntry, setPivotEntry] = useState<TimelineEntry | null>(null);
  
  // Key timestamp creation state
  const [showKeyTimestampModal, setShowKeyTimestampModal] = useState(false);
  const [keyTimestampEntry, setKeyTimestampEntry] = useState<TimelineEntry | null>(null);
  const [keyTimestampForm, setKeyTimestampForm] = useState({ label: '', description: '', color: '#2563EB' });
  
  // LLM analysis state
  const [showAnalyzeModal, setShowAnalyzeModal] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [llmMessage, setLlmMessage] = useState('Checking LLM availability...');
  const [llmChecked, setLlmChecked] = useState(false);
  
  // Enhanced table features
  const tableEnhancements = useTableEnhancements(timeline);
  
  // Compute which entries to display - once allEntries are loaded, keep using them
  // Don't switch back to paginated entries after highlight is removed
  const displayEntries = allEntries.length > 0 ? allEntries : entries;

  // Initialize visible columns when timeline loads
  useEffect(() => {
    if (timeline?.columns && visibleColumns.length === 0) {
      setVisibleColumns(timeline.columns.map(c => c.name));
    }
  }, [timeline]);

  // Track previous search/filter state to detect changes
  const prevSearchQueryRef = useRef(searchQuery);
  const prevFiltersRef = useRef(filters);
  
  useEffect(() => {
    // Check if search or filters changed (not just page)
    const searchChanged = prevSearchQueryRef.current !== searchQuery;
    const filtersChanged = JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters);
    const shouldClearAll = searchChanged || filtersChanged;
    
    loadData(shouldClearAll);
    
    // Update refs
    prevSearchQueryRef.current = searchQuery;
    prevFiltersRef.current = filters;
  }, [id, page, searchQuery, filters]);
  
  // Special handler for entry highlighting - fetch specific entry if not found
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const entryParam = searchParams.get('entry');
    
    if (entryParam && !loading && entries.length > 0 && !loadingAll) {
      const entryId = parseInt(entryParam, 10);
      const entryExists = entries.some(e => e.id === entryId);
      const entryExistsInAll = allEntries.some(e => e.id === entryId);
      
      // If the entry isn't in the current page and not already fetched
      if (!entryExists && !entryExistsInAll) {
        fetchSpecificEntry(entryId);
      }
    }
  }, [location.search, entries, loading, loadingAll]);
  
  // Join project WebSocket room
  useEffect(() => {
    if (timeline?.project_id) {
      joinProject(timeline.project_id);
      return () => {
        leaveProject(timeline.project_id);
      };
    }
  }, [timeline?.project_id]);
  
  // Check if navigated from notification or search with selected entry
  useEffect(() => {
    // Check URL query parameter first (from search results - only highlight, don't open comments)
    const searchParams = new URLSearchParams(location.search);
    const entryParam = searchParams.get('entry');
    
    if (entryParam) {
      const entryId = parseInt(entryParam, 10);
      if (!isNaN(entryId)) {
        // Only set highlighted, NOT selectedEntryId (which opens comments)
        setHighlightedEntryId(entryId);
        
        // Remove highlight after 5 seconds
        const highlightTimer = setTimeout(() => {
          setHighlightedEntryId(null);
        }, 5000);
        
        // Remove the query parameter from URL after a longer delay to ensure data loads and scrolling completes
        const urlCleanupTimer = setTimeout(() => {
          const newUrl = `${location.pathname}`;
          window.history.replaceState({}, document.title, newUrl);
        }, 3000);
        
        return () => {
          clearTimeout(highlightTimer);
          clearTimeout(urlCleanupTimer);
        };
      }
    }
    
    // Check location state (from notification clicks - open comments)
    const state = location.state as { selectedEntryId?: number };
    if (state?.selectedEntryId) {
      setSelectedEntryId(state.selectedEntryId);
      setHighlightedEntryId(state.selectedEntryId);
      
      // Remove highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedEntryId(null);
      }, 3000);
      
      // Clear the state so it doesn't persist on refresh
      window.history.replaceState({}, document.title);
      
      return () => clearTimeout(timer);
    }
  }, [location]);
  
  // Load transforms when manual input modal opens
  useEffect(() => {
    if (showManualInput && transforms.length === 0) {
      loadTransforms();
    }
  }, [showManualInput]);
  
  // Check LLM availability on mount
  useEffect(() => {
    const checkLLMStatus = async () => {
      try {
        const response = await llmAPI.getStatus();
        setLlmAvailable(response.data.available);
        setLlmMessage(response.data.message);
        setLlmChecked(true);
      } catch (error: any) {
        setLlmAvailable(false);
        setLlmMessage('Failed to check LLM status: ' + (error.response?.data?.error || error.message));
        setLlmChecked(true);
      }
    };
    checkLLMStatus();
  }, []);

  const loadData = async (clearAllEntries: boolean = false) => {
    try {
      const timelineRes = await timelineAPI.get(Number(id), false);
      setTimeline(timelineRes.data.timeline);
      
      // Check if we have filters or search query
      const hasFilters = Object.keys(filters).length > 0;
      
      if (searchQuery || hasFilters) {
        // Use search endpoint which supports filters
        const entriesRes = await timelineAPI.search(Number(id), searchQuery || '', page, 50, { filter: filters });
        setEntries(entriesRes.data.entries);
        setTotalPages(entriesRes.data.pages || 1);
      } else {
        // No filters or search, use regular list
        const entriesRes = await timelineAPI.listEntries(Number(id), page, 50);
        setEntries(entriesRes.data.entries);
        setTotalPages(entriesRes.data.pages || 1);
      }
      
      // Only clear allEntries if explicitly requested (e.g., when filters/search change)
      // Don't clear it on normal page load, as we want to preserve fetched entries
      if (clearAllEntries) {
        setAllEntries([]);
      }
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecificEntry = async (entryId: number) => {
    setLoadingAll(true);
    try {
      // First, get the specific entry to find its timestamp
      const entryRes = await timelineAPI.getEntry(Number(id), entryId);
      const fetchedEntry = entryRes.data.entry;
      
      // Find timestamp column
      const timestampColumn = timeline?.columns?.find(c => c.column_type === 'timestamp');
      
      if (!timestampColumn) {
        // Fallback: just add to current entries
        const combinedEntries = [fetchedEntry, ...entries];
        setAllEntries(combinedEntries);
        return;
      }
      
      const entryTimestamp = fetchedEntry.data[timestampColumn.name];
      
      // Fetch entries centered around this timestamp
      const surroundingRes = await timelineAPI.getEntriesAroundTimestamp(
        Number(id),
        entryTimestamp,
        timestampColumn.name,
        100  // Get 100 entries: ~50 before, ~50 after
      );
      
      const surroundingEntries = surroundingRes.data.entries;
      setAllEntries(surroundingEntries);
    } catch (error) {
      console.error(`Failed to fetch entry ${entryId}:`, error);
    } finally {
      setLoadingAll(false);
    }
  };

  const loadAllEntries = async () => {
    setLoadingAll(true);
    try {
      // Check if we have filters or search query
      const hasFilters = Object.keys(filters).length > 0;
      
      if (searchQuery || hasFilters) {
        // Use search endpoint which supports filters
        const entriesRes = await timelineAPI.search(Number(id), searchQuery || '', 1, 10000, { filter: filters });
        setAllEntries(entriesRes.data.entries);
        return entriesRes.data.entries;
      } else {
        // No filters or search, use regular list
        const entriesRes = await timelineAPI.listEntries(Number(id), 1, 10000);
        setAllEntries(entriesRes.data.entries);
        return entriesRes.data.entries;
      }
    } catch (error) {
      console.error('Failed to load all entries:', error);
      return [];
    } finally {
      setLoadingAll(false);
    }
  };

  // Load all entries when switching to visualization modes or when search/filters change
  useEffect(() => {
    if (['gantt', 'clusters', 'heatmap'].includes(viewMode) && id) {
      loadAllEntries();
    }
  }, [viewMode, id, searchQuery, filters]);

  const handleCreateEntry = async (data: any) => {
    try {
      await timelineAPI.createEntry(Number(id), data);
      await loadData();
    } catch (error: any) {
      console.error('Failed to create entry:', error);
      throw error;
    }
  };

  const handleUpdateEntry = async (entryId: number, data: any) => {
    try {
      await timelineAPI.updateEntry(Number(id), entryId, data);
      loadData();
    } catch (error) {
      console.error('Failed to update entry:', error);
      throw error;
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }
    
    try {
      await timelineAPI.deleteEntry(Number(id), entryId);
      loadData();
    } catch (error) {
      console.error('Failed to delete entry:', error);
    }
  };

  const handlePromoteEntries = async (entryIds: number[]) => {
    try {
      await timelineAPI.promote(Number(id), entryIds);
      // Optionally reload data to show any changes
    } catch (error: any) {
      console.error('Failed to promote entries:', error);
      throw error;
    }
  };
  
  const handlePivot = (entry: TimelineEntry) => {
    setPivotEntry(entry);
    setShowTimePivot(true);
  };

  const handleTimelinePivot = async (windowMinutes: number) => {
    if (!pivotEntry || !timeline) return;
    
    // Find timestamp column
    const timestampColumn = timeline.columns?.find(c => c.column_type === 'timestamp');
    if (!timestampColumn) {
      alert('This timeline does not have a timestamp column');
      return;
    }
    
    const pivotTime = pivotEntry.data[timestampColumn.name];
    if (!pivotTime) {
      alert('Selected entry does not have a timestamp value');
      return;
    }
    
    // Calculate time window
    const pivotDate = new Date(pivotTime);
    const startTime = new Date(pivotDate.getTime() - windowMinutes * 60 * 1000);
    const endTime = new Date(pivotDate.getTime() + windowMinutes * 60 * 1000);
    
    // Apply filter
    const newFilters = {
      ...filters,
      [timestampColumn.name]: {
        start: startTime.toISOString(),
        end: endTime.toISOString()
      }
    };
    
    setFilters(newFilters);
    setPage(1);
    setShowTimePivot(false);
    setPivotEntry(null);
  };

  const handleProjectWidePivot = async (windowMinutes: number) => {
    if (!pivotEntry || !timeline) return;
    
    // Find timestamp column
    const timestampColumn = timeline.columns?.find(c => c.column_type === 'timestamp');
    if (!timestampColumn) {
      alert('This timeline does not have a timestamp column');
      return;
    }
    
    const pivotTime = pivotEntry.data[timestampColumn.name];
    if (!pivotTime) {
      alert('Selected entry does not have a timestamp value');
      return;
    }
    
    // Calculate time window
    const pivotDate = new Date(pivotTime);
    const startTime = new Date(pivotDate.getTime() - windowMinutes * 60 * 1000);
    const endTime = new Date(pivotDate.getTime() + windowMinutes * 60 * 1000);
    
    // Navigate to project search with time range
    setShowTimePivot(false);
    setPivotEntry(null);
    navigate(`/projects/${timeline.project_id}/search?start=${startTime.toISOString()}&end=${endTime.toISOString()}`);
  };

  const handleCreateKeyTimestamp = (entry: TimelineEntry) => {
    setKeyTimestampEntry(entry);
    
    // Find timestamp column
    const timestampColumn = timeline?.columns?.find(c => c.column_type === 'timestamp');
    if (!timestampColumn) {
      alert('This timeline does not have a timestamp column');
      return;
    }
    
    // Pre-fill label with some entry data
    const firstTextColumn = timeline?.columns?.find(c => c.column_type === 'text');
    const defaultLabel = firstTextColumn && entry.data[firstTextColumn.name] 
      ? String(entry.data[firstTextColumn.name]).substring(0, 50)
      : 'Key Event';
    
    setKeyTimestampForm({
      label: defaultLabel,
      description: '',
      color: '#2563EB'
    });
    setShowKeyTimestampModal(true);
  };

  const handleSaveKeyTimestamp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyTimestampEntry || !timeline) return;
    
    // Find timestamp column
    const timestampColumn = timeline.columns?.find(c => c.column_type === 'timestamp');
    if (!timestampColumn) {
      alert('This timeline does not have a timestamp column');
      return;
    }
    
    const timestamp = keyTimestampEntry.data[timestampColumn.name];
    if (!timestamp) {
      alert('Selected entry does not have a timestamp value');
      return;
    }
    
    try {
      await keyTimestampsAPI.create(timeline.project_id, {
        timestamp,
        label: keyTimestampForm.label,
        description: keyTimestampForm.description,
        color: keyTimestampForm.color
      });
      
      setShowKeyTimestampModal(false);
      setKeyTimestampEntry(null);
      setKeyTimestampForm({ label: '', description: '', color: '#2563EB' });
      alert('Key timestamp created successfully! View it in the project Key Timestamps section.');
    } catch (error: any) {
      console.error('Failed to create key timestamp:', error);
      alert(`Failed to create key timestamp: ${error.response?.data?.error || error.message}`);
    }
  };
  
  const loadTransforms = async () => {
    try {
      const res = await transformAPI.list();
      setTransforms(res.data.transforms);
    } catch (error) {
      console.error('Failed to load transforms:', error);
    }
  };
  
  const validateManualData = async () => {
    if (!selectedTransform || !manualData.trim()) {
      setValidationError('Please select a transform and paste data');
      return;
    }
    
    setValidating(true);
    setValidationError(null);
    setValidationPreview(null);
    
    try {
      const res = await transformAPI.test(selectedTransform, manualData);
      if (res.data.success && res.data.preview) {
        setValidationPreview(res.data.preview);
      } else {
        setValidationError(res.data.error || 'Validation failed');
      }
    } catch (error: any) {
      setValidationError(error.response?.data?.error || error.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };
  
  const handleManualImport = async () => {
    if (!validationPreview || validationPreview.length === 0) {
      alert('Please validate data first');
      return;
    }
    
    setImporting(true);
    try {
      // Import the validated data to the timeline
      await uploadAPI.processInline({
        content: manualData,
        timeline_id: Number(id),
        transform_id: selectedTransform!
      });
      setShowManualInput(false);
      setManualData('');
      setSelectedTransform(null);
      setValidationPreview(null);
      setValidationError(null);
      loadData();
      alert(`Successfully imported ${validationPreview.length} entries`);
    } catch (error: any) {
      alert(`Import failed: ${error.response?.data?.error || error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
  const handleAnalyzeTimeline = async () => {
    if (!timeline) return;
    
    setAnalyzing(true);
    setAnalysisComplete(false);
    
    try {
      // Start the analysis job
      const response = await llmAPI.analyzeTimeline(timeline.id);
      const jobId = response.data.job.id;
      
      // Poll job status every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const jobResponse = await jobsAPI.get(jobId);
          const job = jobResponse.data?.job;
          
          if (!job) {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setShowAnalyzeModal(false);
            alert('Failed to get job status. Please check if the job exists.');
            return;
          }
          
          if (job.status === 'success') {
            clearInterval(pollInterval);
            setAnalysisComplete(true);
            setAnalyzing(false);
            setShowAnalyzeModal(false);
            loadData(); // Reload to get updated entries with analysis data
            alert('Timeline analysis complete! Priority scores and MITRE techniques have been added to events.');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setShowAnalyzeModal(false);
            alert(`Analysis failed: ${job.error_message || 'Unknown error'}`);
          } else if (job.status === 'cancelled') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            setShowAnalyzeModal(false);
            alert('Analysis was cancelled');
          }
        } catch (pollError: any) {
          console.error('Error polling job status:', pollError);
          clearInterval(pollInterval);
          setAnalyzing(false);
          setShowAnalyzeModal(false);
          alert(`Failed to check job status: ${pollError.message}`);
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to start analysis:', error);
      alert(`Analysis failed to start: ${error.response?.data?.error || error.message}`);
      setAnalyzing(false);
      setShowAnalyzeModal(false);
    }
  };
  
  const handleAnalyzeEntries = async (entryIds: number[]) => {
    if (!timeline || entryIds.length === 0) return;
    
    try {
      // Analyze each selected entry (both priority and MITRE ATT&CK)
      for (const entryId of entryIds) {
        await llmAPI.analyzeEntryPriority(entryId);
        await llmAPI.analyzeEntryAttack(entryId);
      }
      await loadData(); // Reload to get updated entries
      
      alert(
        `Successfully analyzed ${entryIds.length} ${entryIds.length === 1 ? 'entry' : 'entries'}!\n\n` +
        `Updated columns:\n` +
        `- Priority: Event importance score\n` +
        `- LLM Analysis: MITRE technique details\n` +
        `- MITRE ATT&CK: Mapped tactics`
      );
    } catch (error: any) {
      console.error('Failed to analyze entries:', error);
      alert(`Failed to analyze entries: ${error.response?.data?.error || error.message}`);
    }
  };
  
  const handleDetectAttackChains = async () => {
    if (!timeline) return;
    
    const confirmed = window.confirm(
      'This will use the LLM to detect attack chains and automatically create Attack Chain visualizations.\n\n' +
      'Make sure you have already analyzed entries with MITRE ATT&CK mappings for best results.\n\n' +
      'Continue?'
    );
    
    if (!confirmed) return;
    
    setAnalyzing(true);
    
    try {
      // Start the chain detection job
      const response = await llmAPI.detectAndCreateChainsAsync(timeline.id, {
        min_confidence: 0.6  // Only create chains with 60%+ confidence
      });
      const jobId = response.data.job.id;
      
      // Poll job status every 2 seconds
      const pollInterval = setInterval(async () => {
        try {
          const jobResponse = await jobsAPI.get(jobId);
          const job = jobResponse.data?.job;
          
          if (!job) {
            clearInterval(pollInterval);
            setAnalyzing(false);
            alert('Failed to get job status. Please check if the job exists.');
            return;
          }
          
          if (job.status === 'success') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            
            const result = job.result_data || {};
            
            // Handle both array and length-based checking
            const createdChains = result.created_chains || [];
            const detectedChains = result.detected_chains || [];
            const createdCount = Array.isArray(createdChains) ? createdChains.length : 0;
            const detectedCount = Array.isArray(detectedChains) ? detectedChains.length : 0;
            
            if (createdCount > 0) {
              alert(
                `Attack Chain Detection Complete!\n\n` +
                `Created ${createdCount} attack chain(s) from ${detectedCount} detection(s).\n\n` +
                `View them in the Attack Chains section.`
              );
            } else {
              alert('No attack chains were detected or met the confidence threshold.');
            }
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            alert(`Chain detection failed: ${job.error_message || 'Unknown error'}`);
          } else if (job.status === 'cancelled') {
            clearInterval(pollInterval);
            setAnalyzing(false);
            alert('Chain detection was cancelled');
          }
        } catch (pollError: any) {
          console.error('Error polling job status:', pollError);
          clearInterval(pollInterval);
          setAnalyzing(false);
          alert(`Failed to check job status: ${pollError.message}`);
        }
      }, 2000);
      
    } catch (error: any) {
      console.error('Failed to start chain detection:', error);
      alert(`Chain detection failed to start: ${error.response?.data?.error || error.message}`);
      setAnalyzing(false);
    }
  };

  // Keyboard shortcuts
  const shortcuts = [
    { key: 'f', ctrl: true, description: 'Focus search', action: () => searchInputRef.current?.focus() },
    { key: 'r', ctrl: true, description: 'Refresh data', action: () => loadData() },
    { key: '1', ctrl: true, description: 'Table view', action: () => setViewMode('table') },
    { key: '2', ctrl: true, description: 'Chart view', action: () => setViewMode('chart') },
    { key: '3', ctrl: true, description: 'Gantt view', action: () => setViewMode('gantt') },
    { key: '4', ctrl: true, description: 'Clusters view', action: () => setViewMode('clusters') },
    { key: '5', ctrl: true, description: 'Heatmap view', action: () => setViewMode('heatmap') },
    { key: 'm', ctrl: true, description: 'Toggle maximize', action: () => setIsMaximized(!isMaximized) },
    { key: 'f', shift: true, description: 'Toggle focus mode', action: () => setIsFocusMode(!isFocusMode) },
    { key: '?', description: 'Show keyboard shortcuts', action: () => setShowHelp(true) },
  ];
  
  useKeyboardShortcuts(shortcuts, !loading);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!timeline) {
    return <div style={{ padding: '20px' }}>Timeline not found</div>;
  }

  return (
    <>
    <div style={{ minHeight: '100vh', backgroundColor: isFocusMode ? '#fff' : '#f5f5f5' }}>
      {/* Header */}
      {!isFocusMode && (
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate(`/projects/${timeline.project_id}`)} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back to Project</button>
          <h1 style={{ margin: 0 }}>Chronosift</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
            <button
              onClick={() => setViewMode('table')}
              style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: viewMode === 'table' ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Table (Ctrl+1)"
            >
              📋
            </button>
            <button
              onClick={() => setViewMode('chart')}
              style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: viewMode === 'chart' ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Chart (Ctrl+2)"
            >
              📊
            </button>
            <button
              onClick={() => setViewMode('gantt')}
              style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: viewMode === 'gantt' ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Gantt (Ctrl+3)"
            >
              📅
            </button>
            <button
              onClick={() => setViewMode('clusters')}
              style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: viewMode === 'clusters' ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Clusters (Ctrl+4)"
            >
              🔍
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              style={{ padding: '6px 10px', fontSize: '12px', backgroundColor: viewMode === 'heatmap' ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Heatmap (Ctrl+5)"
            >
              🔥
            </button>
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="Press ? for shortcuts"
          >
            ⌨️ Shortcuts
          </button>
          <button
            onClick={() => setShowActivityFeed(!showActivityFeed)}
            style={{ padding: '6px 12px', fontSize: '14px', backgroundColor: showActivityFeed ? '#007bff' : '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            title="Toggle Activity Feed"
          >
            📊 Activity
          </button>
          <NotificationBell />
          <span style={{ marginLeft: '10px', marginRight: '10px' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>
      )}

      <div style={{ padding: isFocusMode ? '20px' : (isMaximized ? '10px' : '30px') }}>
        {/* Focus Mode Search Bar - Always visible in focus mode */}
        {isFocusMode && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '15px 20px', 
            backgroundColor: '#fff', 
            border: '1px solid #e5e7eb', 
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button
                onClick={() => setIsFocusMode(false)}
                style={{ 
                  padding: '10px 16px', 
                  backgroundColor: '#dc3545', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontSize: '14px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)'
                }}
                title="Exit Focus Mode (Shift+F)"
              >
                ✕ Exit Focus
              </button>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search timeline entries... (Ctrl+F)"
                style={{ 
                  flex: 1, 
                  padding: '12px 16px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '6px', 
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  style={{ 
                    padding: '10px 16px', 
                    backgroundColor: '#6c757d', 
                    color: '#fff', 
                    border: 'none', 
                    borderRadius: '6px', 
                    cursor: 'pointer', 
                    fontSize: '14px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Clear
                </button>
              )}
              <div style={{ 
                fontSize: '13px', 
                color: '#6b7280', 
                whiteSpace: 'nowrap',
                paddingLeft: '12px',
                borderLeft: '2px solid #e5e7eb'
              }}>
                {timeline.name} • {entries.length} entries • Page {page}/{totalPages}
              </div>
            </div>
          </div>
        )}
        
        {/* Timeline Info */}
        {!isMaximized && !isFocusMode && (
          <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h2 style={{ margin: '0 0 10px 0' }}>{timeline.name}</h2>
            {timeline.description && <p style={{ margin: '0 0 10px 0', color: '#666' }}>{timeline.description}</p>}
            <div style={{ fontSize: '14px', color: '#999', marginBottom: '15px' }}>
              {entries.length} entries (Page {page} of {totalPages})
            </div>
            
            {/* Search Bar */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search timeline entries... (Ctrl+F)"
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setPage(1);
                  }}
                  style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Maximize Toggle */}
        {!isFocusMode && (
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {isMaximized && `${timeline.name} - ${entries.length} entries (Page ${page} of ${totalPages})`}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsFocusMode(true)}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: '#6366f1', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500'
              }}
              title="Focus Mode - Hide everything except timeline (Shift+F)"
            >
              🎯 Focus Mode
            </button>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              style={{ 
                padding: '8px 16px', 
                backgroundColor: isMaximized ? '#dc3545' : '#28a745', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer', 
                fontSize: '14px',
                fontWeight: '500'
              }}
              title={isMaximized ? 'Exit Maximize (Ctrl+M)' : 'Maximize Table (Ctrl+M)'}
            >
              {isMaximized ? '⬇️ Show All' : '⬆️ Maximize Table'}
            </button>
          </div>
        </div>
        )}

        {/* Saved Views */}
        {!isMaximized && !isFocusMode && (
          <SavedViews
            timelineId={timeline.id}
            onLoadView={(view) => {
              if (view.filter_config) setFilters(view.filter_config);
              if (view.column_widths) tableEnhancements.setColumnWidths(view.column_widths);
              if (view.visible_columns) setVisibleColumns(view.visible_columns);
              setPage(1);
              loadData();
            }}
            currentState={{
              filter: filters,
              columnWidths: tableEnhancements.columnWidths,
              visibleColumns: visibleColumns,
            }}
          />
        )}

        {/* Saved Queries */}
        {!isMaximized && !isFocusMode && (
          <SavedQueries
            timelineId={timeline.id}
            onLoadQuery={(query) => {
              setActiveQueryConfig(query.query_config);
              // Apply the query config - will implement backend support next
              if (query.query_config.search_text) {
                setSearchQuery(query.query_config.search_text);
              }
              setPage(1);
              loadData();
            }}
            pendingQueryConfig={pendingQueryConfig}
          />
        )}

        {/* Filter Panel - Available in all views */}
        {!isMaximized && !isFocusMode && (
          <FilterPanel 
            timeline={timeline} 
            entries={displayEntries}
            onApplyFilters={(newFilters) => { setFilters(newFilters); setPage(1); }} 
          />
        )}

        {/* View Mode Content */}
        {viewMode === 'table' && (
          <>
            {/* Column Visibility Toggle */}
            {!isMaximized && !isFocusMode && (
              <ColumnVisibilityToggle
                columns={timeline.columns || []}
                visibleColumns={visibleColumns}
                onToggle={setVisibleColumns}
              />
            )}

            {/* Advanced Filter Panel */}
            {!isMaximized && !isFocusMode && (
              <AdvancedFilterPanel
                timeline={timeline}
                onApplyFilters={(queryConfig) => {
                  setPendingQueryConfig(queryConfig);
                  setActiveQueryConfig(queryConfig);
                  // For now, use search_text; backend needs to support full query config
                  if (queryConfig.search_text) {
                    setSearchQuery(queryConfig.search_text);
                  }
                  setPage(1);
                  loadData();
                }}
                onSaveQuery={(queryConfig) => {
                  setPendingQueryConfig(queryConfig);
                }}
                initialQuery={activeQueryConfig}
              />
            )}

            {/* Column Manager */}
            {!isMaximized && !isFocusMode && (
              <ColumnManager timeline={timeline} onUpdate={loadData} />
            )}

            {/* File Uploader, Manual Input, Enrichment, IOC Extraction, and LLM Analysis */}
            {!isMaximized && !isFocusMode && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <FileUploader timelineId={timeline.id} onComplete={loadData} />
              <button
                onClick={() => setShowManualInput(true)}
                style={{ padding: '10px 20px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', whiteSpace: 'nowrap' }}
              >
                📝 Manual Input
              </button>
              <button
                onClick={() => {
                  if (!llmAvailable) {
                    alert(`LLM Analysis Not Available\n\n${llmMessage}\n\nPlease configure an LLM provider in backend/.env:\n- For OpenAI: Set OPENAI_API_KEY\n- For local: Set LOCAL_LLM_BASE_URL and ensure Ollama/LM Studio is running\n\nThen restart: docker-compose restart backend celery_worker`);
                    return;
                  }
                  setShowAnalyzeModal(true);
                }}
                disabled={entries.length === 0 || !llmChecked}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: (entries.length > 0 && llmAvailable && llmChecked) ? '#6366f1' : '#ccc', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: (entries.length > 0 && llmAvailable && llmChecked) ? 'pointer' : 'not-allowed', 
                  fontSize: '14px', 
                  whiteSpace: 'nowrap',
                  opacity: !llmAvailable && llmChecked ? 0.6 : 1
                }}
                title={!llmChecked ? 'Checking LLM availability...' : (!llmAvailable ? `LLM not available: ${llmMessage}` : "Analyze timeline events with LLM to detect threats and assign MITRE ATT&CK techniques")}
              >
                {!llmChecked ? '⏳ Checking...' : '🧠 Analyze Timeline'}
              </button>
              <button
                onClick={() => {
                  if (!llmAvailable) {
                    alert(`LLM Analysis Not Available\n\n${llmMessage}\n\nPlease configure an LLM provider in backend/.env:\n- For OpenAI: Set OPENAI_API_KEY\n- For local: Set LOCAL_LLM_BASE_URL and ensure Ollama/LM Studio is running\n\nThen restart: docker-compose restart backend celery_worker`);
                    return;
                  }
                  handleDetectAttackChains();
                }}
                disabled={entries.length === 0 || analyzing || !llmChecked}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: (entries.length > 0 && !analyzing && llmAvailable && llmChecked) ? '#dc2626' : '#ccc', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: (entries.length > 0 && !analyzing && llmAvailable && llmChecked) ? 'pointer' : 'not-allowed', 
                  fontSize: '14px', 
                  whiteSpace: 'nowrap',
                  opacity: !llmAvailable && llmChecked ? 0.6 : 1
                }}
                title={!llmChecked ? 'Checking LLM availability...' : (!llmAvailable ? `LLM not available: ${llmMessage}` : "Use LLM to detect attack chains and automatically create visualizations")}
              >
                {!llmChecked ? '⏳ Checking...' : (analyzing ? '⏳ Detecting...' : '🔗 Detect Chains')}
              </button>
              <button
                onClick={() => {
                  if (entries.length > 0) {
                    // Use first entry (you can enhance this to use selected rows from TimelineTable)
                    setEnrichmentEntry(entries[0]);
                    setShowEnrichment(true);
                  } else {
                    alert('No entries available. Please load or create timeline entries first.');
                  }
                }}
                disabled={entries.length === 0}
                style={{ 
                  padding: '10px 20px', 
                  backgroundColor: entries.length > 0 ? '#9333ea' : '#ccc', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: entries.length > 0 ? 'pointer' : 'not-allowed', 
                  fontSize: '14px', 
                  whiteSpace: 'nowrap' 
                }}
                title="Extract and enrich IP addresses, domains, hashes, and emails from the first entry"
              >
                ✨ Enrich First Entry
              </button>
              <IOCExtractor 
                projectId={timeline.project_id}
                timelineId={timeline.id}
                onExtractionComplete={loadData}
              />
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Tip: Use IOC extraction to find security indicators across all entries
                </span>
              </div>
            )}

            {/* Timeline Table */}
            <div style={isFocusMode ? {
              height: totalPages > 1 ? 'calc(100vh - 250px)' : 'calc(100vh - 180px)', // Adjust for pagination if needed
              display: 'flex',
              flexDirection: 'column'
            } : undefined}>
            <EnhancedTimelineTable
              timeline={timeline}
              entries={displayEntries}
              visibleColumns={visibleColumns}
              columnWidths={tableEnhancements.columnWidths}
              onColumnResize={tableEnhancements.setColumnWidths}
              onColumnReorder={tableEnhancements.setColumnOrder}
              frozenColumns={tableEnhancements.frozenColumns}
              onToggleFreeze={tableEnhancements.toggleFreeze}
              isFocusMode={isFocusMode}
            >
              <TimelineTable
                timeline={timeline}
                entries={displayEntries}
                visibleColumns={visibleColumns}
                onCreateEntry={handleCreateEntry}
                onUpdateEntry={handleUpdateEntry}
                onDeleteEntry={handleDeleteEntry}
                onPromoteEntries={handlePromoteEntries}
                onEnrichEntry={(entry) => {
                  setEnrichmentEntry(entry);
                  setShowEnrichment(true);
                }}
                onAnalyzeEntries={handleAnalyzeEntries}
                onEntryClick={(entryId) => setSelectedEntryId(entryId)}
                highlightedEntryId={highlightedEntryId}
                onPivot={handlePivot}
                onCreateKeyTimestamp={handleCreateKeyTimestamp}
                projectId={timeline.project_id}
                llmAvailable={llmAvailable}
                llmChecked={llmChecked}
                llmMessage={llmMessage}
              />
            </EnhancedTimelineTable>
            </div>
          </>
        )}

        {viewMode === 'chart' && entries.length > 0 && (
          <TimelineChart entries={entries} columns={timeline.columns || []} />
        )}

        {viewMode === 'gantt' && (
          loadingAll ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading all entries...</div>
          ) : allEntries.length > 0 ? (
            <GanttTimelineView entries={allEntries} columns={timeline.columns || []} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No entries to display</div>
          )
        )}

        {viewMode === 'clusters' && (
          loadingAll ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading all entries...</div>
          ) : allEntries.length > 0 ? (
            <EventClusterView entries={allEntries} columns={timeline.columns || []} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No entries to display</div>
          )
        )}

        {viewMode === 'heatmap' && (
          loadingAll ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading all entries...</div>
          ) : allEntries.length > 0 ? (
            <ActivityHeatmap entries={allEntries} columns={timeline.columns || []} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>No entries to display</div>
          )
        )}

        {/* Keyboard Shortcuts Help */}
        {showHelp && (
          <KeyboardShortcutsHelp
            shortcuts={shortcuts}
            onClose={() => setShowHelp(false)}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && !isFocusMode && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ padding: '8px 16px', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
            >
              Previous
            </button>
            <span style={{ padding: '8px 16px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ padding: '8px 16px', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
            >
              Next
            </button>
          </div>
        )}
        
        {/* Focus Mode Pagination */}
        {totalPages > 1 && isFocusMode && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px 15px', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: '12px',
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{ 
                padding: '10px 20px', 
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                backgroundColor: page === 1 ? '#e5e7eb' : '#3b82f6',
                color: page === 1 ? '#9ca3af' : '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              ← Previous
            </button>
            <span style={{ 
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151'
            }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{ 
                padding: '10px 20px', 
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                backgroundColor: page === totalPages ? '#e5e7eb' : '#3b82f6',
                color: page === totalPages ? '#9ca3af' : '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
      
      {/* Manual Input Modal */}
      {showManualInput && (
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
          onClick={() => setShowManualInput(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '30px',
              maxWidth: '900px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Manual Data Input</h2>
            
            <div style={{ backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', padding: '12px', marginBottom: '20px' }}>
              <strong>⚠️ Important:</strong> Your data must include column headers. CSV data should have a header row, JSON should have field names.
            </div>
            
            {/* Transform Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Select Transform</label>
              <select
                value={selectedTransform || ''}
                onChange={(e) => {
                  setSelectedTransform(e.target.value ? Number(e.target.value) : null);
                  setValidationPreview(null);
                  setValidationError(null);
                }}
                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
              >
                <option value="">-- Choose a transform --</option>
                {transforms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.input_format.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Data Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Paste Your Data</label>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                💡 Tip: You can copy directly from Excel/Google Sheets - it will auto-convert to CSV
              </div>
              <textarea
                value={manualData}
                onChange={(e) => {
                  setManualData(e.target.value);
                  setValidationPreview(null);
                  setValidationError(null);
                }}
                onPaste={(e) => {
                  // Smart paste handler for Excel/TSV data
                  const pastedText = e.clipboardData.getData('text');
                  
                  // Detect if this is TSV (tab-separated) data from Excel
                  // Check if there are tabs and no commas in first line (likely TSV)
                  const firstLine = pastedText.split('\n')[0];
                  const hasTabs = firstLine.includes('\t');
                  const hasCommas = firstLine.includes(',');
                  
                  if (hasTabs && !hasCommas) {
                    // This is likely TSV from Excel, convert to CSV
                    e.preventDefault();
                    
                    // Convert TSV to CSV
                    const csvData = pastedText
                      .split('\n')
                      .map(line => {
                        // Split by tabs and handle fields with commas/quotes
                        return line
                          .split('\t')
                          .map(field => {
                            // If field contains comma, newline, or quote, wrap in quotes
                            if (field.includes(',') || field.includes('\n') || field.includes('"')) {
                              return '"' + field.replace(/"/g, '""') + '"';
                            }
                            return field;
                          })
                          .join(',');
                      })
                      .join('\n');
                    
                    setManualData(csvData);
                    setValidationPreview(null);
                    setValidationError(null);
                  }
                  // If it's already CSV or other format, let default paste happen
                }}
                placeholder={selectedTransform ? "Paste your data here...\n\nSupports:\n- CSV (comma-separated)\n- TSV (Excel copy/paste)\n- JSON\n- XML" : "Select a transform first"}
                disabled={!selectedTransform}
                style={{ width: '100%', minHeight: '200px', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }}
              />
            </div>
            
            {/* Validation Button */}
            <button
              onClick={validateManualData}
              disabled={!selectedTransform || !manualData.trim() || validating}
              style={{
                padding: '10px 20px',
                backgroundColor: selectedTransform && manualData.trim() ? '#007bff' : '#ccc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedTransform && manualData.trim() ? 'pointer' : 'not-allowed',
                marginBottom: '20px',
                fontSize: '14px'
              }}
            >
              {validating ? 'Validating...' : '🔍 Validate Data'}
            </button>
            
            {/* Validation Error */}
            {validationError && (
              <div style={{ backgroundColor: '#f8d7da', border: '1px solid #dc3545', borderRadius: '4px', padding: '12px', marginBottom: '20px', color: '#721c24' }}>
                <strong>Error:</strong> {validationError}
              </div>
            )}
            
            {/* Validation Preview */}
            {validationPreview && validationPreview.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ backgroundColor: '#d4edda', border: '1px solid #28a745', borderRadius: '4px', padding: '12px', marginBottom: '15px', color: '#155724' }}>
                  <strong>✅ Validation Successful!</strong> Found {validationPreview.length} valid entries.
                </div>
                
                <h4 style={{ marginBottom: '10px' }}>Preview (first 5 entries):</h4>
                <div style={{ overflowX: 'auto', maxHeight: '300px', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead style={{ backgroundColor: '#f8f9fa', position: 'sticky', top: 0 }}>
                      <tr>
                        {Object.keys(validationPreview[0]).map((key) => (
                          <th key={key} style={{ textAlign: 'left', padding: '10px', borderBottom: '2px solid #dee2e6' }}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {validationPreview.slice(0, 5).map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          {Object.keys(validationPreview[0]).map((key) => (
                            <td key={key} style={{ padding: '10px' }}>{String(row[key] || '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowManualInput(false);
                  setManualData('');
                  setSelectedTransform(null);
                  setValidationPreview(null);
                  setValidationError(null);
                }}
                style={{ padding: '10px 20px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#fff' }}
              >
                Cancel
              </button>
              <button
                onClick={handleManualImport}
                disabled={!validationPreview || validationPreview.length === 0 || importing}
                style={{
                  padding: '10px 20px',
                  backgroundColor: validationPreview && validationPreview.length > 0 ? '#28a745' : '#ccc',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: validationPreview && validationPreview.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                {importing ? 'Importing...' : `✓ Import ${validationPreview?.length || 0} Entries`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    
    {/* Entity Enrichment Modal - Outside main div for proper z-index */}
    {showEnrichment && enrichmentEntry && (
      <EntityEnrichment
        entryId={enrichmentEntry.id}
        entryData={enrichmentEntry.data}
        onClose={() => {
          setShowEnrichment(false);
          setEnrichmentEntry(null);
        }}
      />
    )}
    
    {/* Comments Modal */}
    {selectedEntryId && timeline && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '600px',
          backgroundColor: '#fff',
          boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Comments</h3>
          <button
            onClick={() => setSelectedEntryId(null)}
            style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ✕ Close
          </button>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          <CommentSection entryId={selectedEntryId} projectId={timeline.project_id} />
        </div>
      </div>
    )}
    
    {/* Activity Feed Modal */}
    {showActivityFeed && timeline && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '500px',
          backgroundColor: '#fff',
          boxShadow: '-2px 0 10px rgba(0,0,0,0.1)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }}
      >
        <div style={{ padding: '20px', borderBottom: '1px solid #dee2e6', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Activity Feed</h3>
          <button
            onClick={() => setShowActivityFeed(false)}
            style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            ✕ Close
          </button>
        </div>
        <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
          <ActivityFeed projectId={timeline.project_id} />
        </div>
      </div>
    )}
    
    {/* Time Pivot Modal */}
    {showTimePivot && pivotEntry && timeline && (
      <TimePivot
        selectedEntry={pivotEntry}
        timestampColumn={timeline.columns?.find(c => c.column_type === 'timestamp')?.name || 'timestamp'}
        onPivot={handleTimelinePivot}
        onProjectWidePivot={handleProjectWidePivot}
        onClose={() => {
          setShowTimePivot(false);
          setPivotEntry(null);
        }}
      />
    )}

    {/* Key Timestamp Creation Modal */}
    {showKeyTimestampModal && keyTimestampEntry && timeline && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1002
        }}
        onClick={() => {
          setShowKeyTimestampModal(false);
          setKeyTimestampEntry(null);
          setKeyTimestampForm({ label: '', description: '', color: '#2563EB' });
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: 'var(--radius-2xl)',
            padding: '32px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: 'var(--shadow-xl)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>
            🔖 Create Key Timestamp
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '24px' }}>
            Mark this entry as a key moment in your investigation
          </p>

          <form onSubmit={handleSaveKeyTimestamp}>
            {/* Timestamp Display */}
            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginBottom: '4px' }}>Timestamp</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--gray-900)', fontFamily: 'monospace' }}>
                {(() => {
                  const timestampColumn = timeline.columns?.find(c => c.column_type === 'timestamp');
                  const timestamp = timestampColumn ? keyTimestampEntry.data[timestampColumn.name] : null;
                  return timestamp ? new Date(timestamp).toLocaleString() : 'No timestamp';
                })()}
              </div>
            </div>

            {/* Label */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--gray-900)'
              }}>
                Label *
              </label>
              <input
                type="text"
                value={keyTimestampForm.label}
                onChange={(e) => setKeyTimestampForm({ ...keyTimestampForm, label: e.target.value })}
                required
                maxLength={200}
                placeholder="e.g., Initial Compromise"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none'
                }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--gray-900)'
              }}>
                Description
              </label>
              <textarea
                value={keyTimestampForm.description}
                onChange={(e) => setKeyTimestampForm({ ...keyTimestampForm, description: e.target.value })}
                placeholder="Optional details about this key moment..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '1rem',
                  border: '1px solid var(--gray-300)',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Color Picker */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: 'var(--gray-900)'
              }}>
                Color
              </label>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { value: '#DC2626', label: 'Critical' },
                  { value: '#F59E0B', label: 'Suspicious' },
                  { value: '#FCD34D', label: 'Warning' },
                  { value: '#10B981', label: 'Resolution' },
                  { value: '#2563EB', label: 'Info' },
                  { value: '#9333EA', label: 'Analysis' },
                  { value: '#E94B8B', label: 'Important' },
                ].map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setKeyTimestampForm({ ...keyTimestampForm, color: color.value })}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-md)',
                      background: color.value,
                      border: keyTimestampForm.color === color.value ? '3px solid var(--gray-900)' : '2px solid var(--gray-300)',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)',
                      transform: keyTimestampForm.color === color.value ? 'scale(1.1)' : 'scale(1)'
                    }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowKeyTimestampModal(false);
                  setKeyTimestampEntry(null);
                  setKeyTimestampForm({ label: '', description: '', color: '#2563EB' });
                }}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  color: 'var(--gray-700)',
                  border: '2px solid var(--gray-300)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '12px 24px',
                  background: 'var(--accent-pink)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                🔖 Create Key Timestamp
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    
    {/* LLM Analysis Modal */}
    {showAnalyzeModal && (
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
        onClick={() => !analyzing && setShowAnalyzeModal(false)}
      >
        <div
          style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '30px',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '24px', fontWeight: 600 }}>
            🧠 Analyze Timeline with LLM
          </h2>
          
          <div style={{ marginBottom: '24px', color: '#666', lineHeight: '1.6' }}>
            <p>This will analyze all events in the timeline using an AI model to:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Assign priority scores (0.0 - 1.0) based on security significance</li>
              <li>Map events to MITRE ATT&CK techniques and tactics</li>
              <li>Identify potential attack chains and patterns</li>
              <li>Provide confidence scores for each analysis</li>
            </ul>
            <p style={{ marginTop: '15px', padding: '12px', backgroundColor: '#fef3c7', borderRadius: '6px', fontSize: '14px' }}>
              <strong>⚠️ Note:</strong> Analysis may take several minutes depending on the number of events.
            </p>
          </div>
          
          {analyzing && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e0e7ff', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', marginBottom: '10px' }}>⏳ Analyzing timeline...</div>
              <div style={{ fontSize: '14px', color: '#666' }}>This may take a few minutes. Please wait.</div>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowAnalyzeModal(false)}
              disabled={analyzing}
              style={{
                padding: '12px 24px',
                background: 'transparent',
                color: analyzing ? '#ccc' : '#6c757d',
                border: `2px solid ${analyzing ? '#ccc' : '#6c757d'}`,
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: analyzing ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAnalyzeTimeline}
              disabled={analyzing}
              style={{
                padding: '12px 24px',
                background: analyzing ? '#ccc' : '#6366f1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: analyzing ? 'not-allowed' : 'pointer',
                boxShadow: analyzing ? 'none' : '0 2px 8px rgba(99, 102, 241, 0.3)'
              }}
            >
              {analyzing ? '⏳ Analyzing...' : '🚀 Start Analysis'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
