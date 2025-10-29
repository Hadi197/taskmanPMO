import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, Layers, Clock, User } from 'lucide-react';
import { supabase } from './supabaseClient';

const STATUS_COLORS = {
  'Not Started': 'bg-gradient-to-r from-slate-400 to-slate-500',
  'Working on it': 'bg-gradient-to-r from-amber-400 to-orange-500',
  'Stuck': 'bg-gradient-to-r from-red-400 to-rose-500',
  'Done': 'bg-gradient-to-r from-emerald-400 to-teal-500',
  'Review': 'bg-gradient-to-r from-indigo-400 to-purple-500'
};

const PRIORITY_COLORS = {
  'Low': 'bg-gradient-to-r from-slate-400 to-slate-500',
  'Medium': 'bg-gradient-to-r from-amber-400 to-orange-500',
  'High': 'bg-gradient-to-r from-orange-400 to-red-500',
  'Critical': 'bg-gradient-to-r from-red-500 to-rose-600'
};

export default function SubSubTaskTree({ taskId, boardId, onTaskUpdate }) {
  const [subSubTasks, setSubSubTasks] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (taskId || boardId) {
      loadSubSubTasks();
    }
  }, [taskId, boardId]);

  const loadSubSubTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('sub_sub_task')
        .select(`
          *,
          tasks:task_id (
            id,
            title,
            board_id
          )
        `)
        .order('level', { ascending: true })
        .order('order_index', { ascending: true });

      if (taskId) {
        query = query.eq('task_id', taskId);
      } else if (boardId) {
        // Get all tasks for this board first, then filter sub_sub_tasks
        const { data: boardTasks } = await supabase
          .from('tasks')
          .select('id')
          .eq('board_id', boardId);

        if (boardTasks && boardTasks.length > 0) {
          const taskIds = boardTasks.map(t => t.id);
          query = query.in('task_id', taskIds);
        } else {
          setSubSubTasks([]);
          return;
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setSubSubTasks(data || []);
    } catch (error) {
      console.error('Error loading sub-sub-tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildTree = (tasks) => {
    const taskMap = new Map();
    const rootTasks = [];

    // Initialize all tasks in map
    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

    // Build hierarchy
    tasks.forEach(task => {
      if (task.parent_sub_task_id) {
        const parent = taskMap.get(task.parent_sub_task_id);
        if (parent) {
          parent.children.push(taskMap.get(task.id));
        }
      } else {
        rootTasks.push(taskMap.get(task.id));
      }
    });

    return rootTasks;
  };

  const toggleExpanded = (taskId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedNodes(newExpanded);
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    try {
      const { error } = await supabase
        .from('sub_sub_task')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setSubSubTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, status: newStatus } : task
        )
      );

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Error updating task status: ' + error.message);
    }
  };

  const deleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this sub-task? This will also delete all its child tasks.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('sub_sub_task')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Reload tasks
      await loadSubSubTasks();

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task: ' + error.message);
    }
  };

  const renderTaskNode = (task, level = 0) => {
    const hasChildren = task.children && task.children.length > 0;
    const isExpanded = expandedNodes.has(task.id);
    const indent = level * 24; // 24px per level

    return (
      <div key={task.id}>
        <div
          className="flex items-center py-4 px-4 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 rounded-2xl group mx-2 my-1 transition-all duration-300 border border-transparent hover:border-indigo-200"
          style={{ paddingLeft: `${16 + indent}px` }}
        >
          {/* Expand/Collapse button */}
          <div className="flex items-center w-8">
            {hasChildren ? (
              <button
                onClick={() => toggleExpanded(task.id)}
                className="p-2 hover:bg-gradient-to-r hover:from-indigo-100 hover:to-purple-100 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-110"
              >
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-indigo-600" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-indigo-600" />
                )}
              </button>
            ) : (
              <div className="w-5" />
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center w-8">
            <div className={`w-4 h-4 rounded-full shadow-sm border-2 border-white ${STATUS_COLORS[task.status] || 'bg-gradient-to-r from-slate-400 to-slate-500'}`} />
          </div>

          {/* Task content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3">
              <Layers className="w-5 h-5 text-indigo-500 flex-shrink-0" />
              <span className="text-base font-semibold text-indigo-900 truncate">
                {task.title}
              </span>
              <span className="text-xs bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 px-3 py-1 rounded-full font-semibold shadow-sm border border-emerald-200">
                Level {task.level}
              </span>
              {task.tasks && (
                <span className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full flex-shrink-0 font-semibold shadow-sm border border-blue-200">
                  {task.tasks.title || 'Unknown Task'}
                </span>
              )}
            </div>

            {task.description && (
              <p className="text-sm text-indigo-700 mt-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                {task.description}
              </p>
            )}

            <div className="flex items-center space-x-4 mt-3">
              {/* Priority */}
              <div className="flex items-center space-x-2 bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-2 rounded-xl border border-amber-200">
                <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gradient-to-r from-slate-400 to-slate-500'} shadow-sm`} />
                <span className="text-sm font-semibold text-amber-800">{task.priority}</span>
              </div>

              {/* Assigned to */}
              {task.assigned_to && (
                <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-100 to-pink-100 px-3 py-2 rounded-xl border border-purple-200">
                  <User className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-800">{task.assigned_to}</span>
                </div>
              )}

              {/* Due date */}
              {task.due_date && (
                <div className="flex items-center space-x-2 bg-gradient-to-r from-rose-100 to-pink-100 px-3 py-2 rounded-xl border border-rose-200">
                  <Clock className="w-4 h-4 text-rose-600" />
                  <span className="text-sm font-semibold text-rose-800">
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status dropdown */}
          <div className="flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
            <select
              value={task.status}
              onChange={(e) => updateTaskStatus(task.id, e.target.value)}
              className="text-sm border-2 border-indigo-200 rounded-xl px-3 py-2 bg-white shadow-lg hover:shadow-xl transition-all duration-300 font-medium text-indigo-900"
            >
              {Object.keys(STATUS_COLORS).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <button
              onClick={() => deleteTask(task.id)}
              className="p-2 text-red-500 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-rose-600 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
              title="Delete task"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-8 border-l-2 border-indigo-200 border-dashed">
            {task.children.map(child => renderTaskNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600 mb-4 shadow-xl"></div>
        <span className="text-indigo-700 font-semibold text-lg">Loading hierarchical tasks...</span>
      </div>
    );
  }

  const treeData = buildTree(subSubTasks);

  if (treeData.length === 0) {
    return (
      <div className="text-center py-16 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-3xl border-2 border-indigo-200">
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
          <Layers className="w-10 h-10 text-indigo-500" />
        </div>
        <h3 className="text-2xl font-bold text-indigo-900 mb-3">No hierarchical sub-tasks yet</h3>
        <p className="text-indigo-600 text-lg">Add sub-tasks to organize your work hierarchically</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-indigo-50 border-2 border-indigo-200 rounded-3xl shadow-2xl overflow-hidden">
      <div className="p-8 border-b-2 border-indigo-200 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">
        <h3 className="text-2xl font-bold text-white flex items-center drop-shadow-lg">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mr-4 shadow-xl">
            <Layers className="w-5 h-5 text-white" />
          </div>
          Hierarchical Sub-Tasks ({subSubTasks.length})
        </h3>
      </div>

      <div className="divide-y divide-indigo-100 p-4">
        {treeData.map(task => renderTaskNode(task))}
      </div>
    </div>
  );
}