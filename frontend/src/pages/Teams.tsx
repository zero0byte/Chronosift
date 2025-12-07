import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { teamAPI, userAPI } from '../lib/api';
import { Team, User } from '../types';

export default function Teams() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDesc, setNewTeamDesc] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'member'>('member');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [teamsRes, usersRes] = await Promise.all([
        teamAPI.list(),
        userAPI.list(),
      ]);
      setTeams(teamsRes.data.teams);
      setAllUsers(usersRes.data.users);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamAPI.create({
        name: newTeamName,
        description: newTeamDesc,
      });
      setNewTeamName('');
      setNewTeamDesc('');
      setShowCreateTeam(false);
      loadData();
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team');
    }
  };

  const handleViewTeam = async (teamId: number) => {
    try {
      const res = await teamAPI.get(teamId);
      setSelectedTeam(res.data.team);
      setShowAddMember(false);
    } catch (error) {
      console.error('Failed to load team:', error);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !selectedUserId) return;

    try {
      await teamAPI.addMember(selectedTeam.id, {
        user_id: selectedUserId,
        role: selectedRole,
      });
      setShowAddMember(false);
      setSelectedUserId(null);
      handleViewTeam(selectedTeam.id); // Reload team
    } catch (error) {
      console.error('Failed to add member:', error);
      alert('Failed to add member');
    }
  };

  const handleRemoveMember = async (teamId: number, userId: number) => {
    if (!window.confirm('Remove this member from the team?')) return;

    try {
      await teamAPI.removeMember(teamId, userId);
      handleViewTeam(teamId); // Reload team
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  };

  const handleUpdateRole = async (teamId: number, userId: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await teamAPI.updateMember(teamId, userId, { role: newRole });
      handleViewTeam(teamId); // Reload team
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  };

  const handleDeleteTeam = async (teamId: number, teamName: string) => {
    if (!window.confirm(`Delete team "${teamName}"? All projects and timelines will also be deleted.`)) return;

    try {
      await teamAPI.delete(teamId);
      setSelectedTeam(null);
      loadData();
    } catch (error) {
      console.error('Failed to delete team:', error);
      alert('Failed to delete team');
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#fff', borderBottom: '1px solid #ddd', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '8px 12px', cursor: 'pointer' }}>← Back</button>
          <h1 style={{ margin: 0 }}>Team Management</h1>
        </div>
        <div>
          <span style={{ marginRight: '20px' }}>{user?.full_name}</span>
          <button onClick={logout} style={{ padding: '8px 16px', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      <div style={{ padding: '30px', display: 'flex', gap: '30px' }}>
        {/* Left panel: Team list */}
        <div style={{ flex: '0 0 350px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Teams</h2>
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
                style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newTeamDesc}
                onChange={(e) => setNewTeamDesc(e.target.value)}
                style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '8px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Create</button>
                <button type="button" onClick={() => setShowCreateTeam(false)} style={{ flex: 1, padding: '8px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {teams.map((team) => (
              <div
                key={team.id}
                onClick={() => handleViewTeam(team.id)}
                style={{
                  padding: '15px',
                  backgroundColor: selectedTeam?.id === team.id ? '#e3f2fd' : '#fff',
                  border: `1px solid ${selectedTeam?.id === team.id ? '#2196f3' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                <h4 style={{ margin: '0 0 5px 0' }}>{team.name}</h4>
                {team.description && <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#666' }}>{team.description}</p>}
                <div style={{ fontSize: '12px', color: '#999' }}>
                  {team.members?.length || 0} members
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel: Team details */}
        <div style={{ flex: 1 }}>
          {selectedTeam ? (
            <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: '0 0 5px 0' }}>{selectedTeam.name}</h2>
                  {selectedTeam.description && <p style={{ margin: 0, color: '#666' }}>{selectedTeam.description}</p>}
                </div>
                <button
                  onClick={() => handleDeleteTeam(selectedTeam.id, selectedTeam.name)}
                  style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete Team
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0 }}>Members ({selectedTeam.members?.length || 0})</h3>
                  <button
                    onClick={() => setShowAddMember(!showAddMember)}
                    style={{ padding: '6px 12px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
                  >
                    + Add Member
                  </button>
                </div>

                {showAddMember && (
                  <form onSubmit={handleAddMember} style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                    <select
                      value={selectedUserId || ''}
                      onChange={(e) => setSelectedUserId(Number(e.target.value))}
                      required
                      style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                      <option value="">Select user...</option>
                      {allUsers
                        .filter(u => !selectedTeam.members?.some(m => m.user_id === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.full_name} ({u.email})</option>
                        ))}
                    </select>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as 'admin' | 'member')}
                      style={{ width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button type="submit" style={{ flex: 1, padding: '8px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Add</button>
                      <button type="button" onClick={() => setShowAddMember(false)} style={{ flex: 1, padding: '8px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </form>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Email</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Role</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTeam.members?.map((member) => (
                      <tr key={member.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '10px' }}>{member.user.full_name}</td>
                        <td style={{ padding: '10px' }}>{member.user.email}</td>
                        <td style={{ padding: '10px' }}>
                          <span style={{
                            padding: '4px 8px',
                            backgroundColor: member.role === 'admin' ? '#ffc107' : '#6c757d',
                            color: '#fff',
                            borderRadius: '3px',
                            fontSize: '12px',
                          }}>
                            {member.role}
                          </span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <button
                            onClick={() => handleUpdateRole(selectedTeam.id, member.user_id, member.role)}
                            style={{ padding: '4px 8px', marginRight: '5px', fontSize: '12px', cursor: 'pointer' }}
                          >
                            Toggle Role
                          </button>
                          <button
                            onClick={() => handleRemoveMember(selectedTeam.id, member.user_id)}
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
            </div>
          ) : (
            <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '4px', padding: '40px', textAlign: 'center', color: '#999' }}>
              Select a team to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
