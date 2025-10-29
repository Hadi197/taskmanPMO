import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Calendar, Users, BarChart3, FolderOpen, MoreVertical, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

const STATUS_COLORS = {
  'Not Started': 'bg-gray-400',
  'Working on it': 'bg-orange-500',
  'Stuck': 'bg-red-500',
  'Done': 'bg-green-500',
  'Review': 'bg-blue-500'
};

export default function BoardList({ onBoardSelect, onCreateBoard, onBoardUpdate }) {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDescription, setNewBoardDescription] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBoard, setEditingBoard] = useState(null);
  const [editBoardName, setEditBoardName] = useState('');
  const [editBoardDescription, setEditBoardDescription] = useState('');

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      setLoading(true);
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select(`
          *,
          tasks (
            id,
            status,
            priority,
            created_at,
            assigned_to
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Process boards with task statistics
      const processedBoards = (boardsData || []).map(board => {
        const tasks = board.tasks || [];
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(task => task.status === 'Done').length;
        const inProgressTasks = tasks.filter(task => task.status === 'Working on it').length;
        const overdueTasks = tasks.filter(task => {
          if (!task.due_date) return false;
          return new Date(task.due_date) < new Date() && task.status !== 'Done';
        }).length;

        // Get unique persons assigned to tasks
        const assignedPersons = [...new Set(tasks.map(task => task.assigned_to).filter(Boolean))];

        return {
          ...board,
          stats: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
          },
          assignedPersons
        };
      });

      setBoards(processedBoards);
    } catch (error) {
      console.error('Error loading boards:', error);
      setBoards([]);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async () => {
    if (!newBoardName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('boards')
        .insert([{
          name: newBoardName.trim(),
          description: newBoardDescription.trim()
        }])
        .select()
        .single();

      if (error) throw error;

      setBoards(prev => [data, ...prev]);
      setNewBoardName('');
      setNewBoardDescription('');
      setShowCreateModal(false);

      // Call the parent callback if provided
      if (onCreateBoard) {
        onCreateBoard(data);
      }
    } catch (error) {
      console.error('Error creating board:', error);
      alert('Failed to create board. Please try again.');
    }
  };

  const deleteBoard = async (boardId, boardName) => {
    if (!confirm(`Are you sure you want to delete "${boardName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      setBoards(prev => prev.filter(board => board.id !== boardId));
    } catch (error) {
      console.error('Error deleting board:', error);
      alert('Failed to delete board. Please try again.');
    }
  };

  const openEditModal = (board) => {
    setEditingBoard(board);
    setEditBoardName(board.name);
    setEditBoardDescription(board.description || '');
    setShowEditModal(true);
  };

  const editBoard = async () => {
    if (!editBoardName.trim() || !editingBoard) return;

    try {
      const { data, error } = await supabase
        .from('boards')
        .update({
          name: editBoardName.trim(),
          description: editBoardDescription.trim()
        })
        .eq('id', editingBoard.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setBoards(prev => prev.map(board =>
        board.id === editingBoard.id
          ? { ...board, name: data.name, description: data.description }
          : board
      ));

      // Call parent callback if provided
      if (onBoardUpdate) {
        onBoardUpdate(data);
      }

      setShowEditModal(false);
      setEditingBoard(null);
      setEditBoardName('');
      setEditBoardDescription('');
    } catch (error) {
      console.error('Error editing board:', error);
      alert('Failed to edit board. Please try again.');
    }
  };

  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (board.description && board.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mb-4 shadow-xl"></div>
        <span className="text-indigo-700 font-semibold text-lg">Loading boards...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <FolderOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-indigo-900 drop-shadow-lg">Project Boards</h1>
              <p className="text-indigo-700 text-lg">Manage and organize your project boards</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
          >
            <Plus className="w-5 h-5 mr-3" />
            Create Board
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search boards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl"
          />
        </div>
      </div>

      {/* Boards Grid */}
      {filteredBoards.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <FolderOpen className="w-12 h-12 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-indigo-900 mb-3">
            {searchTerm ? 'No boards found' : 'No boards yet'}
          </h3>
          <p className="text-indigo-600 text-lg mb-8">
            {searchTerm ? 'Try adjusting your search terms' : 'Create your first board to get started'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
            >
              <Plus className="w-5 h-5 mr-3" />
              Create Your First Board
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredBoards.map(board => (
            <div
              key={board.id}
              className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-2 border-indigo-200 hover:shadow-2xl hover:border-purple-300 transition-all duration-300 cursor-pointer group transform hover:scale-[1.02] hover:-translate-y-2"
              onClick={() => onBoardSelect && onBoardSelect(board)}
            >
              {/* Board Header */}
              <div className="p-8 border-b-2 border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-t-3xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <FolderOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-900 text-xl group-hover:text-purple-600 transition-colors duration-300">
                        {board.name}
                      </h3>
                      <p className="text-sm text-indigo-600 font-medium">
                        {new Date(board.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(board);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-3 hover:bg-indigo-100 rounded-xl transition-all duration-300 shadow-lg mr-2"
                      title="Edit board"
                    >
                      <Edit2 className="w-5 h-5 text-indigo-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBoard(board.id, board.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-3 hover:bg-red-100 rounded-xl transition-all duration-300 shadow-lg"
                      title="Delete board"
                    >
                      <Trash2 className="w-5 h-5 text-red-500" />
                    </button>
                  </div>
                </div>

                {board.description && (
                  <p className="text-indigo-700 text-sm line-clamp-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    {board.description}
                  </p>
                )}

                {/* Assigned Persons */}
                {board.assignedPersons && board.assignedPersons.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      <span className="text-xs text-indigo-700 uppercase tracking-wide font-semibold">Team</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {board.assignedPersons.slice(0, 3).map((person, index) => (
                        <div
                          key={index}
                          className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 text-xs font-bold rounded-full shadow-sm border border-purple-200"
                        >
                          {person}
                        </div>
                      ))}
                      {board.assignedPersons.length > 3 && (
                        <div className="inline-flex items-center px-3 py-2 bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 text-xs font-bold rounded-full shadow-sm border border-gray-200">
                          +{board.assignedPersons.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Board Stats */}
              <div className="p-8 bg-gradient-to-br from-white to-indigo-50/30">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="text-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-2xl border border-indigo-100">
                    <div className="text-3xl font-bold text-indigo-900 mb-1">{board.stats.totalTasks}</div>
                    <div className="text-xs text-indigo-600 uppercase tracking-wide font-semibold">Total Tasks</div>
                  </div>
                  <div className="text-center bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-100">
                    <div className="text-3xl font-bold text-emerald-700 mb-1">{board.stats.completedTasks}</div>
                    <div className="text-xs text-emerald-600 uppercase tracking-wide font-semibold">Completed</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-indigo-700 font-semibold">Progress</span>
                    <span className="font-bold text-indigo-900 bg-indigo-100 px-2 py-1 rounded-full text-xs">{board.stats.completionRate}%</span>
                  </div>
                  <div className="w-full bg-gradient-to-r from-indigo-100 to-purple-100 rounded-full h-3 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-emerald-400 to-teal-500 h-3 rounded-full transition-all duration-500 shadow-lg"
                      style={{ width: `${board.stats.completionRate}%` }}
                    ></div>
                  </div>
                </div>

                {/* Status Indicators */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {board.stats.inProgressTasks > 0 && (
                      <div className="flex items-center space-x-2 bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-2 rounded-xl border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-800 font-semibold text-sm">{board.stats.inProgressTasks}</span>
                      </div>
                    )}
                    {board.stats.overdueTasks > 0 && (
                      <div className="flex items-center space-x-2 bg-gradient-to-r from-red-100 to-rose-100 px-3 py-2 rounded-xl border border-red-200">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span className="text-red-800 font-semibold text-sm">{board.stats.overdueTasks}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Board Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl shadow-2xl p-10 w-full max-w-md border-2 border-indigo-200">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-indigo-900">Create New Board</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-3">
                  Board Name *
                </label>
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  placeholder="Enter board name"
                  className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  value={newBoardDescription}
                  onChange={(e) => setNewBoardDescription(e.target.value)}
                  placeholder="Enter board description"
                  rows={4}
                  className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 resize-none bg-white shadow-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-10">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewBoardName('');
                  setNewBoardDescription('');
                }}
                className="px-8 py-3 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={createBoard}
                disabled={!newBoardName.trim()}
                className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                Create Board
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Board Modal */}
      {showEditModal && editingBoard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl shadow-2xl p-10 w-full max-w-md border-2 border-indigo-200">
            <div className="flex items-center space-x-4 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-xl">
                <Edit2 className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-indigo-900">Edit Board</h2>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-3">
                  Board Name *
                </label>
                <input
                  type="text"
                  value={editBoardName}
                  onChange={(e) => setEditBoardName(e.target.value)}
                  placeholder="Enter board name"
                  className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-indigo-800 mb-3">
                  Description (Optional)
                </label>
                <textarea
                  value={editBoardDescription}
                  onChange={(e) => setEditBoardDescription(e.target.value)}
                  placeholder="Enter board description"
                  rows={4}
                  className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 resize-none bg-white shadow-lg"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-10">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingBoard(null);
                  setEditBoardName('');
                  setEditBoardDescription('');
                }}
                className="px-8 py-3 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Cancel
              </button>
              <button
                onClick={editBoard}
                disabled={!editBoardName.trim()}
                className="px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
              >
                Update Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}