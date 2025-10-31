import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Calendar, User, ChevronDown, MoreVertical, Check, TreePine, MessageCircle, Bell, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import Notifications from './Notifications';
import CalendarView from './CalendarView';
import TaskManagement from './TaskManagement';
import Dashboard from './Dashboard';
import Team from './Team';

const TEAM_MEMBERS = [
  { id: 1, name: 'Adi Priatmono', color: 'bg-purple-500' },
  { id: 2, name: 'Dimas', color: 'bg-blue-500' },
  { id: 3, name: 'Zukril', color: 'bg-green-500' },
  { id: 4, name: 'Istriono', color: 'bg-orange-500' },
  { id: 5, name: 'Alexis', color: 'bg-pink-500' },
  { id: 6, name: 'mami Chika', color: 'bg-yellow-500' }
];

export default function MondayClone() {
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBoards(boardsData || []);
      if ((boardsData || []).length > 0) {
        setCurrentBoardId(boardsData[0].id);
      } else {
        setCurrentBoardId(null);
      }
    } catch (error) {
      console.error('Error loading boards:', error);
      setBoards([]);
      setCurrentBoardId(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <TreePine className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Task Management TMO</h2>
          <p className="text-gray-600">Setting up your workspace...</p>
        </div>
      </div>
    );
  }

  const currentBoard = boards.find(b => b.id === currentBoardId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-indigo-100/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <TreePine className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Task Management TMO
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'dashboard'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('tasks')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'tasks'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setCurrentView('team')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'team'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Team
              </button>
              <button
                onClick={() => setCurrentView('calendar')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'calendar'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Calendar
              </button>
              <Notifications />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {currentView === 'dashboard' ? (
          <Dashboard />
        ) : currentView === 'tasks' ? (
          <div className="max-w-7xl mx-auto p-6">
            <TaskManagement boardId={currentBoardId} />
          </div>
        ) : currentView === 'team' ? (
          <Team />
        ) : currentView === 'calendar' ? (
          <CalendarView
            tasks={[]} // Empty tasks array since we removed task functionality
            onTaskClick={() => {}} // Empty function since we removed task functionality
          />
        ) : null}
      </main>
    </div>
  );
}
