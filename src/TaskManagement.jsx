import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Clock, AlertTriangle, User, Calendar, MoreVertical, FileText, Download, X } from 'lucide-react';
import { supabase, handleSupabaseError, retryOperation } from './supabaseClient';
import FileUpload from './FileUpload';

const STATUS_OPTIONS = [
  { value: 'Not Started', label: 'Not Started', color: 'bg-gray-400', progress: 0 },
  { value: 'Working on it', label: 'Working on it', color: 'bg-orange-500', progress: 25 },
  { value: 'Stuck', label: 'Stuck', color: 'bg-red-500', progress: 50 },
  { value: 'Review', label: 'Review', color: 'bg-blue-500', progress: 75 },
  { value: 'Done', label: 'Done', color: 'bg-green-500', progress: 100 }
];

const PRIORITY_OPTIONS = [
  { value: 'Low', label: 'Low', color: 'bg-green-100 text-green-800' },
  { value: 'Medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'High', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'Urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' }
];

export default function TaskManagement({ boardId }) {
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedTaskForDocuments, setSelectedTaskForDocuments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState([]);

  // Form states
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    status: 'Not Started',
    priority: 'Medium',
    assigned_to: '',
    due_date: '',
    progress: 0,
    attachments: [],
    parent_id: null
  });

  useEffect(() => {
    if (boardId) {
      loadTasks();
      loadTeamMembers();
    }
  }, [boardId]);

  const loadTasks = async () => {
    const result = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    });

    if (!result.success) {
      console.error('Failed to load tasks:', result.error);
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = result.data;

      // Organize tasks into hierarchical structure
      const taskMap = new Map();
      const rootTasks = [];

      // First pass: create task map
      data.forEach(task => {
        // Parse attachments from fileid field
        let attachments = [];
        try {
          attachments = task.fileid ? JSON.parse(task.fileid) : [];
        } catch (e) {
          attachments = [];
        }

        taskMap.set(task.id, { ...task, subtasks: [], attachments });
      });

      // Second pass: build hierarchy
      data.forEach(task => {
        if (task.parent_id) {
          const parent = taskMap.get(task.parent_id);
          if (parent) {
            parent.subtasks.push(taskMap.get(task.id));
          }
        } else {
          rootTasks.push(taskMap.get(task.id));
        }
      });

      setTasks(rootTasks);
    } catch (error) {
      console.error('Error processing tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    const result = await retryOperation(async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    });

    if (!result.success) {
      console.error('Failed to load team members:', result.error);
      setTeamMembers([]);
      return;
    }

    setTeamMembers(result.data || []);
  };

  const getTeamMemberRole = (assignedToName) => {
    if (!assignedToName) return null;
    const member = teamMembers.find(member => member.name === assignedToName);
    return member ? member.role : null;
  };

  const toggleTaskExpansion = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleAddTask = async () => {
    if (!taskForm.title.trim()) return;

    const result = await retryOperation(async () => {
      // Explicitly construct the data object with only the fields we want
      const taskData = {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to || null,
        due_date: taskForm.due_date || null,
        progress: taskForm.progress || 0,
        fileid: JSON.stringify(taskForm.attachments),
        board_id: boardId,
        parent_id: taskForm.parent_id
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (error) throw error;
      return data;
    });

    if (!result.success) {
      console.error('Failed to add task:', result.error);
      alert(result.error);
      return;
    }

    setShowAddModal(false);
    resetForm();
    loadTasks();
  };

  const handleUpdateTask = async () => {
    if (!editingTask || !taskForm.title.trim()) return;

    try {
      // Explicitly construct the data object with only the fields we want
      const updateData = {
        title: taskForm.title,
        description: taskForm.description,
        status: taskForm.status,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to || null,
        due_date: taskForm.due_date || null,
        progress: taskForm.progress || 0,
        fileid: JSON.stringify(taskForm.attachments)
      };

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', editingTask.id);

      if (error) throw error;

      setEditingTask(null);
      resetForm();
      loadTasks();
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!confirm(`Are you sure you want to delete "${taskTitle}" and all its subtasks? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const resetForm = () => {
    setTaskForm({
      title: '',
      description: '',
      status: 'Not Started',
      priority: 'Medium',
      assigned_to: '',
      due_date: '',
      progress: 0,
      attachments: [],
      parent_id: null
    });
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to || '',
      due_date: task.due_date || '',
      progress: task.progress || 0,
      attachments: task.attachments || [],
      parent_id: task.parent_id
    });
  };

  const addSubtask = (parentId) => {
    setTaskForm(prev => ({ ...prev, parent_id: parentId }));
    setShowAddModal(true);
  };

  const openDocumentsModal = (task) => {
    setSelectedTaskForDocuments(task);
    setShowDocumentsModal(true);
  };

  const closeDocumentsModal = () => {
    setShowDocumentsModal(false);
    setSelectedTaskForDocuments(null);
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderTaskRow = (task, level = 0) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const statusOption = STATUS_OPTIONS.find(s => s.value === task.status);
    const priorityOption = PRIORITY_OPTIONS.find(p => p.value === task.priority);

    return (
      <React.Fragment key={task.id}>
        <tr className={`border-b border-gray-200 hover:bg-gray-50 ${level > 0 ? 'bg-gray-50' : ''}`}>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex items-center" style={{ paddingLeft: `${level * 24}px` }}>
              {hasSubtasks ? (
                <button
                  onClick={() => toggleTaskExpansion(task.id)}
                  className="mr-2 p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <div className="flex items-center">
                <div>
                  <div className="text-sm font-medium text-gray-900">{task.title}</div>
                  {task.description && (
                    <div className="text-sm text-gray-500 truncate max-w-xs">{task.description}</div>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusOption?.color} text-white`}>
              {task.status}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityOption?.color}`}>
              {task.priority}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {task.assigned_to || '-'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {getTeamMemberRole(task.assigned_to) || '-'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {task.due_date ? new Date(task.due_date).toLocaleDateString() : '-'}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            {task.attachments && task.attachments.length > 0 ? (
              <div className="max-w-xs">
                <div className="flex items-center text-sm text-gray-600 mb-1">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {task.attachments.length} file{task.attachments.length !== 1 ? 's' : ''}
                </div>
                <div className="space-y-1">
                  {task.attachments.slice(0, 2).map((file, index) => (
                    <div key={index} className="text-xs text-gray-500 truncate flex items-center">
                      <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {file.name}
                    </div>
                  ))}
                  {task.attachments.length > 2 && (
                    <div className="text-xs text-gray-400">
                      +{task.attachments.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${statusOption?.color}`}
                style={{ width: `${task.progress || 0}%` }}
              ></div>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">
              {task.progress || 0}%
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <div className="flex items-center justify-end space-x-2">
              {level === 0 && (
                <button
                  onClick={() => addSubtask(task.id)}
                  className="text-indigo-600 hover:text-indigo-900 p-1"
                  title="Add Subtask"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              {task.attachments && task.attachments.length > 0 && (
                <button
                  onClick={() => openDocumentsModal(task)}
                  className="text-green-600 hover:text-green-900 p-1"
                  title="View Documents"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => openEditModal(task)}
                className="text-blue-600 hover:text-blue-900 p-1"
                title="Edit Task"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteTask(task.id, task.title)}
                className="text-red-600 hover:text-red-900 p-1"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && hasSubtasks && task.subtasks.map(subtask => renderTaskRow(subtask, level + 1))}
      </React.Fragment>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-gray-600">Loading tasks...</span>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Task Management</h3>
            <p className="text-sm text-gray-500">Manage your tasks and subtasks in a hierarchical table view</p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setShowAddModal(true);
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Attachments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <p className="text-lg font-medium">No tasks yet</p>
                    <p className="text-sm">Create your first task to get started</p>
                  </div>
                </td>
              </tr>
            ) : (
              tasks.map(task => renderTaskRow(task))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingTask) && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingTask ? 'Edit Task' : 'Add New Task'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Task Name</label>
                  <input
                    type="text"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter task name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter task description"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={taskForm.status}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, status: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Priority</label>
                    <select
                      value={taskForm.priority}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {PRIORITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={taskForm.progress}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, progress: parseInt(e.target.value) || 0 }))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter progress percentage (0-100)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                    <select
                      value={taskForm.assigned_to}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, assigned_to: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Select assignee...</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.name}>{member.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Due Date</label>
                    <input
                      type="date"
                      value={taskForm.due_date}
                      onChange={(e) => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <FileUpload
                taskId={editingTask?.id || 'new'}
                onFilesChange={(files) => setTaskForm(prev => ({ ...prev, attachments: files }))}
                existingFiles={taskForm.attachments}
              />

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTask(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={editingTask ? handleUpdateTask : handleAddTask}
                  disabled={!taskForm.title.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingTask ? 'Update Task' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedTaskForDocuments && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Documents for "{selectedTaskForDocuments.title}"
                </h3>
                <button
                  onClick={closeDocumentsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                {selectedTaskForDocuments.attachments && selectedTaskForDocuments.attachments.length > 0 ? (
                  <div className="grid gap-4">
                    {selectedTaskForDocuments.attachments.map((file, index) => (
                      <div
                        key={file.id || index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="flex-shrink-0">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • Uploaded {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => downloadFile(file)}
                            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No documents uploaded for this task</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={closeDocumentsModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}