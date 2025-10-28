import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Calendar, User, ChevronDown, MoreVertical, Check } from 'lucide-react';
import { supabase } from './supabaseClient';

const STATUS_OPTIONS = [
  { label: 'Not Started', color: 'bg-gray-400' },
  { label: 'Working on it', color: 'bg-orange-500' },
  { label: 'Stuck', color: 'bg-red-500' },
  { label: 'Done', color: 'bg-green-500' },
  { label: 'Review', color: 'bg-blue-500' }
];

const PRIORITY_OPTIONS = [
  { label: 'Low', color: 'bg-gray-400' },
  { label: 'Medium', color: 'bg-yellow-500' },
  { label: 'High', color: 'bg-orange-500' },
  { label: 'Critical', color: 'bg-red-600' }
];

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
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPerson, setFilterPerson] = useState('all');
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' or 'board'

  useEffect(() => {
    loadBoards();
  }, []);

  const loadBoards = async () => {
    try {
      const { data: boardsData, error } = await supabase
        .from('boards')
        .select(`
          *,
          tasks (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Ensure each board has a tasks array and map database fields to UI fields
      const boardsWithTasks = (boardsData || []).map(board => ({
        ...board,
        tasks: (board.tasks || []).map(task => ({
          ...task,
          name: task.title, // Map title to name for UI
          notes: task.description, // Map description to notes for UI
          person: task.assigned_to, // Map assigned_to to person for UI
          dueDate: task.due_date // Map due_date to dueDate for UI
        }))
      }));

      setBoards(boardsWithTasks);
      if (boardsWithTasks.length > 0) {
        setCurrentBoardId(boardsWithTasks[0].id);
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
  };  const addBoard = async () => {
    if (!newBoardName.trim()) return;

    try {
      const { data, error } = await supabase
        .from('boards')
        .insert([
          {
            name: newBoardName,
            description: newBoardDesc,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setBoards(prevBoards => [data, ...prevBoards]);
      setCurrentBoardId(data.id);
      setNewBoardName('');
      setNewBoardDesc('');
      setShowNewBoard(false);
    } catch (error) {
      console.error('Error adding board:', error);
    }
  };

  const deleteBoard = async (boardId) => {
    try {
      const { error } = await supabase
        .from('boards')
        .delete()
        .eq('id', boardId);

      if (error) throw error;

      const updatedBoards = boards.filter(b => b.id !== boardId);
      setBoards(updatedBoards);
      if (currentBoardId === boardId && updatedBoards.length > 0) {
        setCurrentBoardId(updatedBoards[0].id);
      } else if (updatedBoards.length === 0) {
        setCurrentBoardId(null);
      }
    } catch (error) {
      console.error('Error deleting board:', error);
    }
  };

  const addTask = async () => {
    const currentBoard = boards.find(b => b.id === currentBoardId);
    if (!currentBoard) return;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert([
          {
            board_id: currentBoardId,
            title: 'New Task',
            status: 'Not Started',
            priority: 'Medium',
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Map database fields to UI fields
      const uiTask = {
        ...data,
        name: data.title,
        notes: data.description,
        person: data.assigned_to,
        dueDate: data.due_date
      };

      const updatedBoards = boards.map(b =>
        b.id === currentBoardId
          ? { ...b, tasks: [...(b.tasks || []), uiTask] }
          : b
      );

      setBoards(updatedBoards);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };  const updateTask = async (taskId, field, value) => {
    try {
      // Map frontend field names to database column names
      const fieldMapping = {
        'name': 'title',
        'person': 'assigned_to',
        'notes': 'description',
        'dueDate': 'due_date'
      };

      const dbField = fieldMapping[field] || field;
      const dbValue = value;

      const { error } = await supabase
        .from('tasks')
        .update({ [dbField]: dbValue })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state with the UI field name
      const updatedBoards = boards.map(b =>
        b.id === currentBoardId
          ? {
              ...b,
              tasks: (b.tasks || []).map(t =>
                t.id === taskId ? { ...t, [field]: value } : t
              )
            }
          : b
      );

      setBoards(updatedBoards);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      const updatedBoards = boards.map(b =>
        b.id === currentBoardId
          ? { ...b, tasks: (b.tasks || []).filter(t => t.id !== taskId) }
          : b
      );

      setBoards(updatedBoards);
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  const currentBoard = boards.find(b => b.id === currentBoardId);

  const filteredTasks = (currentBoard?.tasks || []).filter(task => {
    const matchesSearch = (task.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (task.notes || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPerson = filterPerson === 'all' || task.person === filterPerson;
    return matchesSearch && matchesPerson;
  });

  const getProgress = () => {
    if (!currentBoard || !currentBoard.tasks || currentBoard.tasks.length === 0) return 0;
    const done = currentBoard.tasks.filter(t => t.status === 'Done').length;
    return Math.round((done / currentBoard.tasks.length) * 100);
  };

  // Dashboard data processing functions
  const getDashboardStats = () => {
    const allTasks = boards.flatMap(board => board.tasks || []);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(task => task.status === 'Done').length;
    const inProgressTasks = allTasks.filter(task => task.status === 'Working on it').length;
    const stuckTasks = allTasks.filter(task => task.status === 'Stuck').length;
    const overdueTasks = allTasks.filter(task => task.due_date && new Date(task.due_date) < new Date()).length;
    const upcomingDeadlines = allTasks
      .filter(task => task.due_date && new Date(task.due_date) >= new Date())
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 5);

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      stuckTasks,
      overdueTasks,
      upcomingDeadlines,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
  };

  const getWorkloadDistribution = () => {
    const workload = {};
    TEAM_MEMBERS.forEach(member => {
      workload[member.name] = 0;
    });

    boards.forEach(board => {
      (board.tasks || []).forEach(task => {
        if (task.person) {
          workload[task.person] = (workload[task.person] || 0) + 1;
        }
      });
    });

    return Object.entries(workload).map(([name, count]) => ({ name, count }));
  };

  const getStatusBreakdown = () => {
    const statusCounts = {
      'Not Started': 0,
      'Working on it': 0,
      'Stuck': 0,
      'Done': 0,
      'Review': 0
    };

    boards.forEach(board => {
      (board.tasks || []).forEach(task => {
        if (statusCounts[task.status] !== undefined) {
          statusCounts[task.status]++;
        }
      });
    });

    return Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
  };

  const getPriorityDistribution = () => {
    const priorityCounts = {
      'Low': 0,
      'Medium': 0,
      'High': 0,
      'Critical': 0
    };

    boards.forEach(board => {
      (board.tasks || []).forEach(task => {
        if (priorityCounts[task.priority] !== undefined) {
          priorityCounts[task.priority]++;
        }
      });
    });

    return Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count }));
  };

  const getTopContributors = () => {
    const contributors = {};
    TEAM_MEMBERS.forEach(member => {
      contributors[member.name] = 0;
    });

    boards.forEach(board => {
      (board.tasks || []).forEach(task => {
        if (task.person && task.status === 'Done') {
          contributors[task.person] = (contributors[task.person] || 0) + 1;
        }
      });
    });

    return Object.entries(contributors)
      .map(([name, completed]) => ({ name, completed }))
      .sort((a, b) => b.completed - a.completed);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white px-6 py-5 shadow-xl border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Check className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Tasks Management TMO PJM</h1>
            </div>
            {/* View Toggle */}
            <div className="flex bg-white/10 rounded-xl p-1 backdrop-blur-sm">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'dashboard'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setCurrentView('board')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  currentView === 'board'
                    ? 'bg-white text-blue-600 shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                📋 Boards
              </button>
            </div>
            {currentView === 'board' && (
              <nav className="flex gap-3">
                {boards.map(board => (
                  <div key={board.id} className="relative group">
                    <button
                      onClick={() => setCurrentBoardId(board.id)}
                      className={`px-5 py-2.5 rounded-xl font-medium transition-all duration-200 transform hover:scale-105 ${
                        currentBoardId === board.id
                          ? 'bg-white/20 shadow-lg ring-2 ring-white/30'
                          : 'bg-white/10 hover:bg-white/15 backdrop-blur-sm'
                      }`}
                    >
                      {board.name}
                    </button>
                    <button
                      onClick={() => deleteBoard(board.id)}
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </nav>
            )}
          </div>
          {currentView === 'board' && (
            <button
              onClick={() => setShowNewBoard(true)}
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm px-5 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Plus size={18} />
              New Board
            </button>
          )}
        </div>
      </header>

      {/* New Board Modal */}
      {showNewBoard && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl border border-gray-200/50 transform transition-all duration-300 scale-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Plus className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Board</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Board Name</label>
                <input
                  type="text"
                  placeholder="Enter board name"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Enter description"
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-8">
              <button
                onClick={addBoard}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Create Board
              </button>
              <button
                onClick={() => {
                  setShowNewBoard(false);
                  setNewBoardName('');
                  setNewBoardDesc('');
                }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-200 transition-all duration-200"
              >
                Cancel
              </button>
            </div>
          </div>

          {/* Typography demo to verify @tailwindcss/typography */}
          <div className="max-w-4xl mx-auto mb-6 px-4">
            <article className="prose prose-lg mx-auto">
              <h3>Typography plugin demo</h3>
              <p>
                This short paragraph demonstrates the Tailwind Typography plugin and the Inter font.
                If configured correctly, you should see improved font sizing, margins, and readable defaults.
              </p>
              <ul>
                <li>Responsive headings and readable body text.</li>
                <li>Better spacing between elements.</li>
                <li>Consistent font family: Inter.</li>
              </ul>
            </article>
          </div>
        </div>
      )}

      {/* Main Content */}
      {currentView === 'dashboard' ? (
        <DashboardView
          boards={boards}
          stats={getDashboardStats()}
          workload={getWorkloadDistribution()}
          statusBreakdown={getStatusBreakdown()}
          priorityDistribution={getPriorityDistribution()}
          topContributors={getTopContributors()}
          onBoardSelect={setCurrentBoardId}
          onViewChange={setCurrentView}
        />
      ) : (
        currentBoard ? (
          <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
            {/* Board Header */}
            <div className="bg-white rounded-2xl p-8 mb-8 shadow-lg border border-gray-200/50">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-4xl font-bold text-gray-900 mb-2">{currentBoard.name}</h2>
                  {currentBoard.description && (
                    <p className="text-gray-600 text-lg">{currentBoard.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">{getProgress()}%</div>
                  <div className="text-sm text-gray-500">Complete</div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>

            {/* Toolbar */}
            <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-gray-200/50">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <select
                  value={filterPerson}
                  onChange={(e) => setFilterPerson(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 min-w-48"
                >
                  <option value="all">All People</option>
                  {TEAM_MEMBERS.map(member => (
                    <option key={member.id} value={member.name}>{member.name}</option>
                  ))}
                </select>
                <button
                  onClick={addTask}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Plus size={20} />
                  New Task
                </button>
              </div>
            </div>

            {/* Task Table */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200/50">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Task</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Person</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Status</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Priority</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Due Date</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900">Notes</th>
                    <th className="px-6 py-4 text-left font-semibold text-gray-900 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredTasks.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                    />
                  ))}
                </tbody>
              </table>
              {filteredTasks.length === 0 && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {searchTerm || filterPerson !== 'all' 
                      ? 'No tasks match your filters'
                      : 'No tasks yet'}
                  </h3>
                  <p className="text-gray-500 mb-6">
                    {searchTerm || filterPerson !== 'all' 
                      ? 'Try adjusting your search or filters'
                      : 'Get started by creating your first task'}
                  </p>
                  {(!searchTerm && filterPerson === 'all') && (
                    <button
                      onClick={addTask}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 mx-auto"
                    >
                      <Plus size={20} />
                      Create First Task
                    </button>
                  )}
                </div>
              )}
            </div>
          </main>
        ) : (
          <main className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to monday!</h2>
              <p className="text-gray-600 mb-8 text-lg">Create your first board to start managing your tasks efficiently.</p>
              <button
                onClick={() => setShowNewBoard(true)}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105 mx-auto"
              >
                <Plus size={24} />
                Create Board
              </button>
            </div>
          </main>
        )
      )}
    </div>
  );
}

function DashboardView({ boards, stats, workload, statusBreakdown, priorityDistribution, topContributors, onBoardSelect, onViewChange }) {
  return (
    <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
      {/* Quick Actions Bar */}
      <div className="bg-white rounded-2xl p-6 mb-8 shadow-lg border border-gray-200/50">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search all tasks..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
          </div>
          <div className="flex gap-3">
            {boards.map(board => (
              <button
                key={board.id}
                onClick={() => {
                  onBoardSelect(board.id);
                  onViewChange('board');
                }}
                className="px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                📋 {board.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Check className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600">{stats.completedTasks}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-3xl font-bold text-orange-600">{stats.inProgressTasks}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-3xl font-bold text-red-600">{stats.overdueTasks}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Summary & Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Progress Summary</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Completion</span>
                <span>{stats.completionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${stats.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {statusBreakdown.map(({ status, count }) => {
              const percentage = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
              const statusColors = {
                'Not Started': 'bg-gray-400',
                'Working on it': 'bg-orange-500',
                'Stuck': 'bg-red-500',
                'Done': 'bg-green-500',
                'Review': 'bg-blue-500'
              };
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                    <span className="text-sm font-medium">{status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{count}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${statusColors[status]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Workload Distribution & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Workload Distribution</h3>
          <div className="space-y-3">
            {workload.map(({ name, count }) => {
              const member = TEAM_MEMBERS.find(m => m.name === name);
              const maxTasks = Math.max(...workload.map(w => w.count));
              const percentage = maxTasks > 0 ? (count / maxTasks) * 100 : 0;
              return (
                <div key={name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 ${member?.color || 'bg-gray-400'} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                      {name[0]}
                    </div>
                    <span className="font-medium">{name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{count} tasks</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Upcoming Deadlines</h3>
          <div className="space-y-3">
            {stats.upcomingDeadlines.length > 0 ? (
              stats.upcomingDeadlines.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{task.name}</p>
                    <p className="text-sm text-gray-600">
                      {task.person && `Assigned to ${task.person}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      {Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24))} days left
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No upcoming deadlines</p>
            )}
          </div>
        </div>
      </div>

      {/* Team Section & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">👥 Team Performance</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-gray-900 mb-3">Top Contributors</h4>
              {topContributors.slice(0, 5).map(({ name, completed }, index) => {
                const member = TEAM_MEMBERS.find(m => m.name === name);
                return (
                  <div key={name} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <div className={`w-8 h-8 ${member?.color || 'bg-gray-400'} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                        {name[0]}
                      </div>
                      <span className="font-medium">{name}</span>
                    </div>
                    <span className="text-sm font-semibold text-green-600">{completed} completed</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
          <h3 className="text-xl font-bold text-gray-900 mb-4">📈 Priority Distribution</h3>
          <div className="space-y-3">
            {priorityDistribution.map(({ priority, count }) => {
              const percentage = stats.totalTasks > 0 ? Math.round((count / stats.totalTasks) * 100) : 0;
              const priorityColors = {
                'Low': 'bg-gray-400',
                'Medium': 'bg-yellow-500',
                'High': 'bg-orange-500',
                'Critical': 'bg-red-600'
              };
              return (
                <div key={priority} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${priorityColors[priority]}`} />
                    <span className="text-sm font-medium">{priority}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{count}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${priorityColors[priority]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications/Alerts */}
      {stats.overdueTasks > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <Calendar className="w-4 h-4 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-red-900">⚠️ Overdue Tasks Alert</h3>
          </div>
          <p className="text-red-700">
            You have <span className="font-semibold">{stats.overdueTasks}</span> overdue tasks that need immediate attention.
          </p>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200/50">
        <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Recent Activity</h3>
        <div className="space-y-3">
          {boards.flatMap(board =>
            (board.tasks || []).slice(0, 3).map(task => (
              <div key={task.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className={`w-8 h-8 ${TEAM_MEMBERS.find(m => m.name === task.person)?.color || 'bg-gray-400'} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                  {task.person ? task.person[0] : '?'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{task.name}</p>
                  <p className="text-sm text-gray-600">
                    {task.person ? `Assigned to ${task.person}` : 'Unassigned'} • {task.status}
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No due date'}
                </span>
              </div>
            ))
          ).slice(0, 5)}
          {boards.flatMap(board => board.tasks || []).length === 0 && (
            <p className="text-gray-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </main>
  );
}

function TaskRow({ task, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showPersonMenu, setShowPersonMenu] = useState(false);

  const statusColor = STATUS_OPTIONS.find(s => s.label === task.status)?.color || 'bg-gray-400';
  const priorityColor = PRIORITY_OPTIONS.find(p => p.label === task.priority)?.color || 'bg-gray-400';
  const personColor = TEAM_MEMBERS.find(m => m.name === task.person)?.color || 'bg-gray-400';

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setShowPersonMenu(false);
        setShowStatusMenu(false);
        setShowPriorityMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <tr className="hover:bg-gray-50/50 transition-colors duration-150">
      <td className="px-6 py-4">
        {editing === 'name' ? (
          <input
            type="text"
            value={task.name || ''}
            onChange={(e) => onUpdate(task.id, 'name', e.target.value)}
            onBlur={() => setEditing(null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditing('name')}
            className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded-lg transition-all duration-200 font-medium text-gray-900"
          >
            {task.name || 'Untitled Task'}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="relative dropdown-container">
          <button
            onClick={() => {
              setShowPersonMenu(!showPersonMenu);
              setShowStatusMenu(false);
              setShowPriorityMenu(false);
            }}
            className={`flex items-center gap-3 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all duration-200 hover:shadow-lg ${
              task.person ? personColor : 'bg-gray-400'
            }`}
          >
            <User size={16} />
            {task.person || 'Unassigned'}
          </button>
          {showPersonMenu && (
            <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 w-56 max-h-64 overflow-y-auto">
              <button
                onClick={() => {
                  onUpdate(task.id, 'person', null);
                  setShowPersonMenu(false);
                }}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User size={16} className="text-gray-500" />
                </div>
                Unassigned
              </button>
              {TEAM_MEMBERS.map(member => (
                <button
                  key={member.id}
                  onClick={() => {
                    onUpdate(task.id, 'person', member.name);
                    setShowPersonMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
                >
                  <div className={`w-8 h-8 ${member.color} rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
                    {member.name[0]}
                  </div>
                  {member.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="relative dropdown-container">
          <button
            onClick={() => {
              setShowStatusMenu(!showStatusMenu);
              setShowPersonMenu(false);
              setShowPriorityMenu(false);
            }}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-all duration-200 hover:shadow-lg ${statusColor}`}
          >
            {task.status}
          </button>
          {showStatusMenu && (
            <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 w-48">
              {STATUS_OPTIONS.map(status => (
                <button
                  key={status.label}
                  onClick={() => {
                    onUpdate(task.id, 'status', status.label);
                    setShowStatusMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
                >
                  <div className={`w-4 h-4 rounded-full ${status.color}`} />
                  {status.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="relative dropdown-container">
          <button
            onClick={() => {
              setShowPriorityMenu(!showPriorityMenu);
              setShowPersonMenu(false);
              setShowStatusMenu(false);
            }}
            className={`px-4 py-2 rounded-xl text-white text-sm font-medium transition-all duration-200 hover:shadow-lg ${priorityColor}`}
          >
            {task.priority}
          </button>
          {showPriorityMenu && (
            <div className="absolute z-50 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 w-40">
              {PRIORITY_OPTIONS.map(priority => (
                <button
                  key={priority.label}
                  onClick={() => {
                    onUpdate(task.id, 'priority', priority.label);
                    setShowPriorityMenu(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3"
                >
                  <div className={`w-4 h-4 rounded-full ${priority.color}`} />
                  {priority.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <input
          type="date"
          value={task.dueDate || ''}
          onChange={(e) => onUpdate(task.id, 'dueDate', e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
        />
      </td>
      <td className="px-6 py-4">
        {editing === 'notes' ? (
          <input
            type="text"
            value={task.notes || ''}
            onChange={(e) => onUpdate(task.id, 'notes', e.target.value)}
            onBlur={() => setEditing(null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setEditing('notes')}
            className="cursor-pointer hover:bg-blue-50 px-3 py-2 rounded-lg transition-all duration-200 text-gray-600"
          >
            {task.notes || 'Add notes...'}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <button
          onClick={() => onDelete(task.id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-all duration-200"
        >
          <Trash2 size={18} />
        </button>
      </td>
    </tr>
  );
}