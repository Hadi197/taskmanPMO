import React, { useState, useEffect } from 'react';
import {
  BarChart3, TrendingUp, Users, Clock, CheckCircle, AlertTriangle,
  Calendar, Plus, Activity, Target, Zap, Award, ChevronRight,
  UserCheck, Timer, PieChart
} from 'lucide-react';
import { supabase } from './supabaseClient';

export default function Dashboard() {
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
    activeProjects: 0,
    completionRate: 0,
    teamMembers: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [statusDistribution, setStatusDistribution] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [boardForm, setBoardForm] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load tasks data
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*');

      if (tasksError) throw tasksError;

      // Load team members data
      const { data: teamMembers, error: teamError } = await supabase
        .from('team_members')
        .select('*');

      if (teamError) throw teamError;

      // Calculate metrics
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(task => task.status === 'Done').length || 0;
      const overdueTasks = tasks?.filter(task => {
        if (!task.due_date) return false;
        return new Date(task.due_date) < new Date() && task.status !== 'Done';
      }).length || 0;

      // Get unique board IDs for active projects
      const activeProjects = new Set(tasks?.map(task => task.board_id)).size || 0;

      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setMetrics({
        totalTasks,
        completedTasks,
        overdueTasks,
        activeProjects,
        completionRate,
        teamMembers: teamMembers?.length || 0
      });

      // Status distribution
      const statusCounts = tasks?.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {}) || {};

      setStatusDistribution(statusCounts);

      // Recent activities based on real task data
      const recentActivitiesData = tasks
        ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        ?.slice(0, 5)
        ?.map((task, index) => {
          const activityTypes = [
            { type: 'task_created', message: 'New task created', icon: Plus, color: 'text-blue-500' },
            { type: 'task_assigned', message: 'Task assigned', icon: UserCheck, color: 'text-green-500' },
            { type: 'task_updated', message: 'Task updated', icon: Activity, color: 'text-purple-500' }
          ];

          const activityType = activityTypes[index % activityTypes.length];

          return {
            id: task.id,
            type: activityType.type,
            message: activityType.message,
            user: task.assigned_to || 'Unassigned',
            task: task.title,
            timestamp: new Date(task.created_at),
            icon: activityType.icon,
            color: activityType.color,
            status: task.status
          };
        }) || [];

      setRecentActivities(recentActivitiesData);

      // Upcoming deadlines
      const deadlines = tasks
        ?.filter(task => task.due_date && task.status !== 'Done')
        ?.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        ?.slice(0, 5)
        ?.map(task => ({
          ...task,
          daysUntilDue: Math.ceil((new Date(task.due_date) - new Date()) / (1000 * 60 * 60 * 24)),
          isOverdue: new Date(task.due_date) < new Date()
        })) || [];

      setUpcomingDeadlines(deadlines);

      // Team performance based on real data
      const teamPerformanceData = teamMembers?.map(member => {
        const memberTasks = tasks?.filter(task => task.assigned_to === member.name) || [];
        const completedTasks = memberTasks.filter(task => task.status === 'Done').length;
        const totalMemberTasks = memberTasks.length;
        const completionRate = totalMemberTasks > 0 ? Math.round((completedTasks / totalMemberTasks) * 100) : 0;

        return {
          name: member.name,
          tasksCompleted: completedTasks,
          totalTasks: totalMemberTasks,
          completionRate,
          avatar: member.name.split(' ').map(n => n[0]).join('').toUpperCase(),
          jabatan: member.jabatan,
          color: member.color
        };
      }).sort((a, b) => b.tasksCompleted - a.tasksCompleted) || [];

      setTeamPerformance(teamPerformanceData);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBoard = async (e) => {
    e.preventDefault();

    if (!boardForm.name.trim()) {
      alert('Board name is required');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('boards')
        .insert([{
          name: boardForm.name.trim(),
          description: boardForm.description.trim(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select();

      if (error) throw error;

      // Reset form and close modal
      setBoardForm({ name: '', description: '' });
      setShowCreateBoardModal(false);

      // Reload dashboard data to reflect new board
      loadDashboardData();

      alert('Board created successfully!');

    } catch (error) {
      console.error('Error creating board:', error);
      alert('Failed to create board. Please try again.');
    }
  };

  const MetricCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50 hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color.replace('text-', 'bg-').replace('-600', '-100')}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  const StatusChart = () => {
    const colors = {
      'Done': 'bg-green-500',
      'Review': 'bg-blue-500',
      'Working on it': 'bg-orange-500',
      'Stuck': 'bg-red-500',
      'Not Started': 'bg-gray-400'
    };

    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-100 to-pink-100 rounded-xl flex items-center justify-center">
            <PieChart className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Status Distribution</h3>
            <p className="text-sm text-gray-600">Task completion breakdown</p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(statusDistribution).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors[status] || 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium text-gray-700">{status}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{count}</span>
                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors[status] || 'bg-gray-400'} transition-all duration-500`}
                    style={{ width: `${metrics.totalTasks > 0 ? (count / metrics.totalTasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Loading Dashboard</h2>
          <p className="text-gray-600">Gathering your project insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-indigo-700 text-lg">Project overview and team insights</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Today</p>
            <p className="text-lg font-semibold text-gray-900">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <MetricCard
            title="Total Tasks"
            value={metrics.totalTasks}
            icon={Target}
            color="text-indigo-600"
            subtitle="All project tasks"
          />
          <MetricCard
            title="Completed"
            value={metrics.completedTasks}
            icon={CheckCircle}
            color="text-green-600"
            subtitle={`${metrics.completionRate}% completion rate`}
          />
          <MetricCard
            title="Overdue"
            value={metrics.overdueTasks}
            icon={AlertTriangle}
            color="text-red-600"
            subtitle="Need immediate attention"
          />
          <MetricCard
            title="Active Projects"
            value={metrics.activeProjects}
            icon={Zap}
            color="text-purple-600"
            subtitle="Ongoing initiatives"
          />
          <MetricCard
            title="Team Members"
            value={metrics.teamMembers}
            icon={Users}
            color="text-blue-600"
            subtitle="Active contributors"
          />
        </div>

        {/* Charts and Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution Chart */}
          <StatusChart />

          {/* Recent Activity */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Activity</h3>
                <p className="text-sm text-gray-600">Latest team updates</p>
              </div>
            </div>

            <div className="space-y-4 max-h-80 overflow-y-auto">
              {recentActivities.map((activity) => {
                const IconComponent = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activity.color.replace('text-', 'bg-').replace('-500', '-100')}`}>
                      <IconComponent className={`w-4 h-4 ${activity.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-semibold">{activity.user}</span> {activity.message.toLowerCase()}
                      </p>
                      <p className="text-xs text-gray-600 truncate">{activity.task}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.timestamp.toLocaleString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Deadlines and Team Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Deadlines */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-100 to-red-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Upcoming Deadlines</h3>
                <p className="text-sm text-gray-600">Tasks requiring attention</p>
              </div>
            </div>

            <div className="space-y-3">
              {upcomingDeadlines.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No upcoming deadlines!</p>
                </div>
              ) : (
                upcomingDeadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        task.isOverdue ? 'bg-red-500' :
                        task.daysUntilDue <= 1 ? 'bg-red-500' :
                        task.daysUntilDue <= 3 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{task.title}</p>
                        <p className="text-xs text-gray-600">
                          Due: {new Date(task.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                      task.isOverdue ? 'bg-red-100 text-red-700' :
                      task.daysUntilDue <= 1 ? 'bg-red-100 text-red-700' :
                      task.daysUntilDue <= 3 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {task.isOverdue ? 'Overdue' :
                       task.daysUntilDue === 0 ? 'Today' :
                       task.daysUntilDue === 1 ? 'Tomorrow' :
                       `${task.daysUntilDue} days`}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team Performance */}
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
                <Award className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Team Performance</h3>
                <p className="text-sm text-gray-600">Individual contributions</p>
              </div>
            </div>

            <div className="space-y-4">
              {teamPerformance.map((member, index) => (
                <div key={member.name} className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-semibold text-sm"
                    style={{ backgroundColor: member.color }}
                  >
                    {member.avatar}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-600">{member.jabatan}</p>
                      </div>
                      <p className="text-sm text-gray-600">{member.tasksCompleted}/{member.totalTasks} tasks</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${member.completionRate}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{member.completionRate}% completion rate</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-gray-100/50">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
              <p className="text-sm text-gray-600">Common tasks and shortcuts</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button
              onClick={() => setShowCreateBoardModal(true)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 group"
            >
              <Plus className="w-6 h-6 text-gray-400 group-hover:text-indigo-500" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-indigo-700">New Board</span>
            </button>

            <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 hover:bg-green-50 transition-all duration-200 group">
              <CheckCircle className="w-6 h-6 text-gray-400 group-hover:text-green-500" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">View Tasks</span>
            </button>

            <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-purple-400 hover:bg-purple-50 transition-all duration-200 group">
              <Calendar className="w-6 h-6 text-gray-400 group-hover:text-purple-500" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700">Calendar</span>
            </button>

            <button className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50 transition-all duration-200 group">
              <Users className="w-6 h-6 text-gray-400 group-hover:text-orange-500" />
              <span className="text-sm font-medium text-gray-700 group-hover:text-orange-700">Team</span>
            </button>
          </div>
        </div>
      </div>

      {/* Create Board Modal */}
      {showCreateBoardModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Board</h3>

              <form onSubmit={createBoard}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Board Name *
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter board name"
                      value={boardForm.name}
                      onChange={(e) => setBoardForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Enter board description"
                      rows="3"
                      value={boardForm.description}
                      onChange={(e) => setBoardForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateBoardModal(false);
                      setBoardForm({ name: '', description: '' });
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                  >
                    Create Board
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}