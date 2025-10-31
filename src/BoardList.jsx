import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Calendar, Users, BarChart3, FolderOpen, MoreVertical, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function BoardList({ boards, currentBoardId, onBoardSelect, onViewChange, onAddBoard }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [boardStats, setBoardStats] = useState({});

  useEffect(() => {
    loadBoardStats();
  }, [boards]);

  const loadBoardStats = async () => {
    if (!boards || boards.length === 0) return;

    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('board_id, status');

      if (error) throw error;

      // Calculate stats for each board
      const stats = {};
      boards.forEach(board => {
        const boardTasks = tasks?.filter(task => task.board_id === board.id) || [];
        const totalTasks = boardTasks.length;
        const completedTasks = boardTasks.filter(task => task.status === 'Done').length;

        stats[board.id] = {
          totalTasks,
          completedTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        };
      });

      setBoardStats(stats);
    } catch (error) {
      console.error('Error loading board stats:', error);
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

      // Reload boards will be handled by parent component
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      console.error('Error deleting board:', error);
      alert('Failed to delete board. Please try again.');
    }
  };

  const filteredBoards = boards.filter(board =>
    board.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (board.description && board.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
            onClick={onAddBoard}
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
              onClick={onAddBoard}
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
              className={`bg-white/90 backdrop-blur-sm rounded-3xl shadow-xl border-2 transition-all duration-300 cursor-pointer group transform hover:scale-[1.02] hover:-translate-y-2 ${
                currentBoardId === board.id
                  ? 'border-purple-400 ring-4 ring-purple-200'
                  : 'border-indigo-200 hover:border-purple-300'
              }`}
              onClick={() => onBoardSelect && onBoardSelect(board.id)}
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
                        // Simple delete action
                        deleteBoard(board.id, board.name);
                      }}
                      className="p-2 text-indigo-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {board.description && (
                  <p className="text-indigo-700 text-sm leading-relaxed">
                    {board.description}
                  </p>
                )}
              </div>

              {/* Board Stats - Dynamic */}
              <div className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-600">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Progress</span>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-900">
                      {boardStats[board.id]?.totalTasks || 0}
                    </div>
                    <div className="text-sm text-indigo-600">
                      {boardStats[board.id]?.completionRate || 0}% complete
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {(boardStats[board.id]?.totalTasks || 0) > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-indigo-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${boardStats[board.id]?.completionRate || 0}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-indigo-600 mt-1">
                      <span>{boardStats[board.id]?.completedTasks || 0} completed</span>
                      <span>{(boardStats[board.id]?.totalTasks || 0) - (boardStats[board.id]?.completedTasks || 0)} pending</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
