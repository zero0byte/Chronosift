import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { teamAPI, projectAPI } from '../lib/api';
import { Team, Project } from '../types';
import NotificationBell from '../components/NotificationBell';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsRes, projectsRes] = await Promise.all([
        teamAPI.list(),
        projectAPI.list(),
      ]);
      setTeams(teamsRes.data.teams);
      setProjects(projectsRes.data.projects);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamAPI.create({ name: newTeamName });
      setNewTeamName('');
      setShowCreateTeam(false);
      loadData();
    } catch (error) {
      console.error('Failed to create team:', error);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId) return;
    
    try {
      await projectAPI.create({ name: newProjectName, team_id: selectedTeamId });
      setNewProjectName('');
      setShowCreateProject(false);
      setSelectedTeamId(null);
      loadData();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>Chronosift</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/users')} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Users</button>
          <button onClick={() => navigate('/teams')} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Teams</button>
          <button onClick={() => navigate('/transforms')} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Transforms</button>
          {user?.is_admin && (
            <button onClick={() => navigate('/jobs')} style={{ padding: '8px 16px', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📊 Jobs</button>
          )}
          <button onClick={() => navigate('/settings')} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>⚙️ Settings</button>
          <NotificationBell />
          <span style={{ marginRight: '5px' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px' }}>
        {/* Teams Section */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>My Teams</h2>
            <button
              onClick={() => setShowCreateTeam(!showCreateTeam)}
              style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              + Create Team
            </button>
          </div>

          {showCreateTeam && (
            <form onSubmit={handleCreateTeam} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
              <input
                type="text"
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
                style={{ width: '300px', padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>Create</button>
              <button type="button" onClick={() => setShowCreateTeam(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            </form>
          )}

          {teams.length === 0 ? (
            <p>No teams yet. Create one to get started!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
              {teams.map((team) => (
                <div key={team.id} style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }} onClick={() => navigate('/teams')}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{team.name}</h3>
                  <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
                    {team.member_count || 0} members
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projects Section */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2>My Projects</h2>
            <button
              onClick={() => setShowCreateProject(!showCreateProject)}
              style={{ padding: '8px 16px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              disabled={teams.length === 0}
            >
              + Create Project
            </button>
          </div>

          {showCreateProject && (
            <form onSubmit={handleCreateProject} style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px' }}>
              <select
                value={selectedTeamId || ''}
                onChange={(e) => setSelectedTeamId(Number(e.target.value))}
                required
                style={{ width: '200px', padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="">Select Team</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Project name"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
                style={{ width: '300px', padding: '8px', marginRight: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '10px' }}>Create</button>
              <button type="button" onClick={() => setShowCreateProject(false)} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
            </form>
          )}

          {projects.length === 0 ? (
            <p>No projects yet. Create one to get started!</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {projects.map((project) => (
                <div key={project.id} style={{ padding: '20px', backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }} onClick={() => navigate(`/projects/${project.id}`)}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{project.name}</h3>
                  {project.description && <p style={{ margin: '0 0 10px 0', color: '#666', fontSize: '14px' }}>{project.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
                    <span>{project.status}</span>
                    <span>{project.timeline_count || 0} timelines</span>
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
