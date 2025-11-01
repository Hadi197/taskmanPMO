import React, { useState, useEffect } from 'react';
import { Users, User, Mail, Calendar, Plus, Edit2, Trash2, MoreVertical, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export default function Team() {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);

  const { currentUserRole, getCurrentUserRole } = useAuth();

  // Helper function to check if current user is admin (Level1)
  const isAdmin = () => currentUserRole === 'Level1';

  // Form states
  const [memberForm, setMemberForm] = useState({
    name: '',
    email: '',
    nipp: '',
    jabatan: '',
    role: 'Level2',
    color: '#8B5CF6'
  });

  useEffect(() => {
    loadTeamMembers();
    getCurrentUserRole();
  }, []);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error loading team members:', error);
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingMember) {
        // Update existing member
        const { error } = await supabase
          .from('team_members')
          .update({
            name: memberForm.name,
            email: memberForm.email,
            nipp: memberForm.nipp,
            jabatan: memberForm.jabatan,
            role: memberForm.role,
            color: memberForm.color
          })
          .eq('id', editingMember.id);

        if (error) throw error;
      } else {
        // Add new member
        const { error } = await supabase
          .from('team_members')
          .insert([{
            name: memberForm.name,
            email: memberForm.email,
            nipp: memberForm.nipp,
            jabatan: memberForm.jabatan,
            role: memberForm.role,
            color: memberForm.color
          }]);

        if (error) throw error;
      }

      // Reset form and reload
      setMemberForm({ name: '', email: '', nipp: '', jabatan: '', role: 'Level2', color: '#8B5CF6' });
      setShowAddModal(false);
      setEditingMember(null);
      loadTeamMembers();
    } catch (error) {
      console.error('Error saving team member:', error);
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name || '',
      email: member.email || '',
      nipp: member.nipp || '',
      jabatan: member.jabatan || '',
      role: member.role || 'Level2',
      color: member.color || '#8B5CF6'
    });
    setShowAddModal(true);
  };

    const handleApproveMember = async (memberId, memberName) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ jabatan: 'approved' })
        .eq('id', memberId);

      if (error) throw error;

      // Update local state
      setTeamMembers(teamMembers.map(member =>
        member.id === memberId ? { ...member, jabatan: 'approved' } : member
      ));

      alert(`${memberName} has been approved and can now login.`);
    } catch (error) {
      console.error('Error approving member:', error);
      alert('Failed to approve member. Please try again.');
    }
  };

  const handleRejectMember = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to reject ${memberName}? They will not be able to login.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .update({ jabatan: 'rejected' })
        .eq('id', memberId);

      if (error) throw error;

      // Update local state
      setTeamMembers(teamMembers.map(member =>
        member.id === memberId ? { ...member, jabatan: 'rejected' } : member
      ));

      alert(`${memberName} has been rejected.`);
    } catch (error) {
      console.error('Error rejecting member:', error);
      alert('Failed to reject member. Please try again.');
    }
  };

  const handleDelete = async (memberId, memberName) => {
    if (!confirm(`Are you sure you want to delete ${memberName}? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      // Update local state
      setTeamMembers(teamMembers.filter(member => member.id !== memberId));

      alert(`${memberName} has been deleted successfully.`);
    } catch (error) {
      console.error('Error deleting member:', error);
      alert('Failed to delete member. Please try again.');
    }
  };

  const colorOptions = [
    '#8B5CF6', // Purple
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Orange
    '#EC4899', // Pink
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Team
            </h1>
            <p className="text-gray-600">Manage your team members</p>
          </div>
        </div>

        {isAdmin() && (
          <button
            onClick={() => {
              setEditingMember(null);
              setMemberForm({ name: '', email: '', nipp: '', jabatan: '', role: 'Level2', color: '#8B5CF6' });
              setShowAddModal(true);
            }}
            className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Team Member
          </button>
        )}
      </div>

      {/* Team Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map((member) => (
          <div
            key={member.id}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-lg"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  {member.email && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {member.email}
                    </p>
                  )}
                  {member.nipp && (
                    <p className="text-sm text-gray-500">
                      NIPP: {member.nipp}
                    </p>
                  )}
                  {member.jabatan && (
                    <p className="text-sm text-gray-500">
                      Jabatan: {member.jabatan}
                    </p>
                  )}
                  {member.role && (
                    <p className="text-sm text-gray-500">
                      Role: {member.role}
                    </p>
                  )}
                  {member.jabatan && (member.jabatan === 'pending_approval' || member.jabatan === 'approved' || member.jabatan === 'rejected') && (
                    <div className="mt-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        member.jabatan === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : member.jabatan === 'pending_approval'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {member.jabatan === 'approved' ? 'Approved' : member.jabatan === 'pending_approval' ? 'Pending Approval' : 'Rejected'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Approval/Rejection buttons for pending members */}
              {isAdmin() && member.jabatan === 'pending_approval' && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => handleApproveMember(member.id, member.name)}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectMember(member.id, member.name)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}

              {isAdmin() && (
                <div className="relative">
                  <button
                    onClick={() => {
                      // Simple dropdown menu
                      const menu = document.getElementById(`menu-${member.id}`);
                      menu.classList.toggle('hidden');
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>

                  <div
                    id={`menu-${member.id}`}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 hidden z-10"
                  >
                    {isAdmin() && (
                      <>
                        <button
                          onClick={() => {
                            handleEdit(member);
                            document.getElementById(`menu-${member.id}`).classList.add('hidden');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            handleDelete(member.id, member.name);
                            document.getElementById(`menu-${member.id}`).classList.add('hidden');
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Joined {new Date(member.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {teamMembers.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No team members yet</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first team member</p>
          {isAdmin() && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
            >
              Add Team Member
            </button>
          )}
          {!isAdmin() && (
            <p className="text-gray-500">Only administrators can add team members</p>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingMember ? 'Edit Team Member' : 'Add Team Member'}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingMember(null);
                  setMemberForm({ name: '', email: '', nipp: '', jabatan: '', role: 'Level2', color: '#8B5CF6' });
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter member name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nipp
                </label>
                <input
                  type="text"
                  value={memberForm.nipp}
                  onChange={(e) => setMemberForm({ ...memberForm, nipp: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter NIPP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jabatan
                </label>
                <input
                  type="text"
                  value={memberForm.jabatan}
                  onChange={(e) => setMemberForm({ ...memberForm, jabatan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Enter jabatan/position"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Level
                </label>
                <select
                  value={memberForm.role}
                  onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="Level1">Level 1</option>
                  <option value="Level2">Level 2</option>
                  <option value="Level3">Level 3</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setMemberForm({ ...memberForm, color })}
                      className={`w-8 h-8 rounded-full border-2 ${
                        memberForm.color === color ? 'border-gray-900' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingMember(null);
                    setMemberForm({ name: '', email: '', nipp: '', jabatan: '', role: 'Level2', color: '#8B5CF6' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all duration-200"
                >
                  {editingMember ? 'Update' : 'Add'} Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}