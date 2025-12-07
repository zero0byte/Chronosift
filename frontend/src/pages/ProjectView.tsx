import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { projectAPI, timelineAPI, teamAPI } from '../lib/api';
import { Project, Timeline, Team } from '../types';
import ProjectSearch from '../components/ProjectSearch';
import { ReportsManagement } from '../components/ReportsManagement';
import IOCManagement from '../components/IOCManagement';
import KeyTimestamps from '../components/KeyTimestamps';
import KeyTimestampSearch from '../components/KeyTimestampSearch';
import AttackChainManager from '../components/AttackChainManager';

export default function ProjectView() {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateTimeline, setShowCreateTimeline] = useState(false);
  const [newTimelineName, setNewTimelineName] = useState('');
  const [newTimelineDesc, setNewTimelineDesc] = useState('');
  const [showManageAccess, setShowManageAccess] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedPermission, setSelectedPermission] = useState<'read' | 'write' | 'admin'>('write');
  const [searchModal, setSearchModal] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [showIOCs, setShowIOCs] = useState(false);
  const [showKeyTimestamps, setShowKeyTimestamps] = useState(false);
  const [searchTimestampId, setSearchTimestampId] = useState<number | undefined>(undefined);
  const [showAttackChains, setShowAttackChains] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const projectRes = await projectAPI.get(Number(id));
      setProject(projectRes.data.project);
      
      const timelinesRes = await projectAPI.listTimelines(Number(id));
      setTimelines(timelinesRes.data.timelines);
      
      // Load team info
      if (projectRes.data.project.team_id) {
        const teamRes = await teamAPI.get(projectRes.data.project.team_id);
        setTeam(teamRes.data.team);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimeline = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await timelineAPI.create({
        name: newTimelineName,
        description: newTimelineDesc,
        project_id: Number(id),
        columns: [
          { name: 'Timestamp', column_type: 'timestamp', is_required: true },
          { name: 'Description', column_type: 'text', is_searchable: true },
          { name: 'Tags', column_type: 'tags' },
        ],
      });
      setNewTimelineName('');
      setNewTimelineDesc('');
      setShowCreateTimeline(false);
      loadData();
    } catch (error) {
      console.error('Failed to create timeline:', error);
    }
  };

  const handleDeleteTimeline = async (timelineId: number, timelineName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigating to timeline when clicking delete
    if (!window.confirm(`Are you sure you want to delete timeline "${timelineName}"? This will delete all entries in the timeline.`)) {
      return;
    }
    
    try {
      await timelineAPI.delete(timelineId);
      loadData();
    } catch (error) {
      console.error('Failed to delete timeline:', error);
      alert('Failed to delete timeline');
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      await projectAPI.addMember(Number(id), {
        user_id: selectedUserId,
        permissions: selectedPermission,
      });
      setSelectedUserId(null);
      setShowManageAccess(false);
      loadData();
      alert('Member added successfully');
    } catch (error: any) {
      console.error('Failed to add member:', error);
      alert(`Failed to add member: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!window.confirm('Remove this member from the project?')) return;

    try {
      await projectAPI.removeMember(Number(id), userId);
      loadData();
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (!project) {
    return <div style={{ padding: '20px' }}>Project not found</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ margin: 0 }}>Chronosift</h1>
        </div>
        <div>
          <span style={{ marginRight: '20px' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        {/* Project Info */}
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h2 style={{ margin: '0 0 10px 0' }}>{project.name}</h2>
              {project.description && <p style={{ margin: '0 0 10px 0', color: '#666' }}>{project.description}</p>}
              <div style={{ display: 'flex', gap: '20px', fontSize: '14px', color: '#999' }}>
                <span>Status: {project.status}</span>
                <span>Team: {team?.name}</span>
                <span>Members: {project.members?.length || 0}</span>
                <span>Timelines: {timelines.length}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowKeyTimestamps(!showKeyTimestamps)}
                style={{ padding: '8px 16px', backgroundColor: '#E94B8B', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔖 Key Timestamps
              </button>
              <button
                onClick={() => setShowAttackChains(!showAttackChains)}
                style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔗 Attack Chains
              </button>
              <button
                onClick={() => setShowIOCs(!showIOCs)}
                style={{ padding: '8px 16px', backgroundColor: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🛡️ IOCs
              </button>
              <button
                onClick={() => setShowReports(!showReports)}
                style={{ padding: '8px 16px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                📊 Reports
              </button>
              <button
                onClick={() => setSearchModal(!searchModal)}
                style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                🔍 Search Project
              </button>
              <button
                onClick={() => setShowManageAccess(!showManageAccess)}
                style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Manage Access
              </button>
            </div>
          </div>
        </div>

        {/* Key Timestamps Section */}
        {showKeyTimestamps && (
          <div style={{ marginBottom: '30px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
            <KeyTimestamps 
              projectId={Number(id)} 
              onSearch={(timestampId) => setSearchTimestampId(timestampId)}
            />
          </div>
        )}

        {/* Key Timestamp Search Modal */}
        {searchTimestampId !== undefined && (
          <KeyTimestampSearch
            projectId={Number(id)}
            timestampId={searchTimestampId}
            onClose={() => setSearchTimestampId(undefined)}
          />
        )}

        {/* Attack Chain Builder Section */}
        {showAttackChains && (
          <div style={{ marginBottom: '30px', height: '800px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
            <AttackChainManager projectId={Number(id)} />
          </div>
        )}

        {/* IOC Management Section */}
        {showIOCs && (
          <div style={{ marginBottom: '30px', height: '600px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
            <IOCManagement projectId={Number(id)} />
          </div>
        )}

        {/* Reports Section */}
        {showReports && (
          <div style={{ marginBottom: '30px' }}>
            <ReportsManagement projectId={Number(id)} timelines={timelines} />
          </div>
        )}

        {/* Search Section - Modal */}
        {searchModal && (
          <ProjectSearch 
            projectId={Number(id)} 
            timelines={timelines}
            onClose={() => setSearchModal(false)}
            isModal={true}
          />
        )}

        {/* Manage Access Section */}
        {showManageAccess && (
          <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>Project Access</h3>
            
            {/* Add Member Form */}
            <form onSubmit={handleAddMember} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Add Team Member</label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <option value="">Select member...</option>
                    {team?.members
                      ?.filter(tm => !project.members?.some(pm => pm.user_id === tm.user_id))
                      .map(tm => (
                        <option key={tm.user_id} value={tm.user_id}>{tm.user.full_name} ({tm.user.email})</option>
                      ))}
                  </select>
                </div>
                <div style={{ flex: '0 0 150px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>Permission</label>
                  <select
                    value={selectedPermission}
                    onChange={(e) => setSelectedPermission(e.target.value as 'read' | 'write' | 'admin')}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
              </div>
            </form>

            {/* Current Members */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Permission</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {project.members?.map((member) => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>{member.user.full_name}</td>
                    <td style={{ padding: '10px' }}>{member.user.email}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: member.permissions === 'admin' ? '#ffc107' : member.permissions === 'write' ? '#28a745' : '#6c757d',
                        color: '#fff',
                        borderRadius: '3px',
                        fontSize: '12px',
                      }}>
                        {member.permissions}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        style={{ padding: '4px 8px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Timelines Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>Timelines</h2>
            <button
              onClick={() => setShowCreateTimeline(!showCreateTimeline)}
              style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Create Timeline
            </button>
          </div>

          {showCreateTimeline && (
            <form onSubmit={handleCreateTimeline} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
              <input
                type="text"
                placeholder="Timeline name"
                value={newTimelineName}
                onChange={(e) => setNewTimelineName(e.target.value)}
                required
                style={{ width: '300px', padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newTimelineDesc}
                onChange={(e) => setNewTimelineDesc(e.target.value)}
                style={{ width: '300px', padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>Create</button>
              <button type="button" onClick={() => setShowCreateTimeline(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                Default columns will be created: Timestamp, Description, Tags
              </div>
            </form>
          )}

          {timelines.length === 0 ? (
            <p>No timelines yet. Create one to get started!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {timelines.map((timeline) => (
                <div 
                  key={timeline.id} 
                  style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', position: 'relative' }} 
                  onClick={() => navigate(`/timelines/${timeline.id}`)}
                >
                  <button
                    onClick={(e) => handleDeleteTimeline(timeline.id, timeline.name, e)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      padding: '4px 8px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                    title="Delete timeline"
                  >
                    🗑️
                  </button>
                  <h3 style={{ margin: '0 0 10px 0', paddingRight: '30px' }}>{timeline.name}</h3>
                  {timeline.description && <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{timeline.description}</p>}
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {timeline.entry_count} entries
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
