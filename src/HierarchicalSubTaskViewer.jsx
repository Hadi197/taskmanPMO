import React, { useState, useEffect, useCallback } from 'react';
import {
  TreePine,
  List,
  Grid3X3,
  Search,
  Filter,
  Download,
  Upload,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Layers,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  XCircle,
  Edit2,
  Trash2,
  Save,
  X,
  Plus
} from 'lucide-react';
import SubSubTaskInput from './SubSubTaskInput';
import { supabase } from './supabaseClient';

const STATUS_ICONS = {
  'Not Started': <XCircle className="w-4 h-4 text-slate-400" />,
  'Working on it': <PlayCircle className="w-4 h-4 text-amber-500" />,
  'Stuck': <AlertCircle className="w-4 h-4 text-red-500" />,
  'Done': <CheckCircle className="w-4 h-4 text-emerald-500" />,
  'Review': <CheckCircle className="w-4 h-4 text-indigo-500" />
};

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

const VIEW_MODES = {
  TREE: 'tree',
  LIST: 'list',
  KANBAN: 'kanban',
  STATS: 'stats'
};

export default function HierarchicalSubTaskViewer({ boardId, taskId }) {
  const [subSubTasks, setSubSubTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedTask, setSelectedTask] = useState(null);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showSubSubEditModal, setShowSubSubEditModal] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  // Separate state to control the upload modal so it does not conflict with delete confirmations
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [_uploading, setUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState(new Map()); // taskId -> documents array
  const [documentsExpanded, setDocumentsExpanded] = useState(true); // Control documents section visibility
  const [teamMembers, setTeamMembers] = useState([]); // Available team members for assignment

  const loadSubSubTasks = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('sub_sub_task')
        .select(`
          *,
          tasks:task_id (
            id,
            title
          )
        `)
        .order('level', { ascending: true })
        .order('order_index', { ascending: true });

      // If taskId is provided, filter by specific task
      if (taskId) {
        query = query.eq('task_id', taskId);
      } else if (boardId) {
        // If no taskId but boardId is provided, get all tasks for this board
        const { data: boardTasks } = await supabase
          .from('tasks')
          .select('id, title')
          .eq('board_id', boardId);

        if (!boardTasks || boardTasks.length === 0) {
          setSubSubTasks([]);
          return;
        }

        const taskIds = boardTasks.map(t => t.id);
        query = query.in('task_id', taskIds);
      }
      // If neither taskId nor boardId is provided, load all sub_sub_tasks

      const { data, error } = await query;

      if (error) throw error;

      setSubSubTasks(data || []);

      // Load documents for all tasks
      if (data && data.length > 0) {
        const taskIds = [...new Set(data.map(task => task.id))];
        await Promise.all(taskIds.map(taskId => loadTaskDocuments(taskId)));
      }
    } catch (error) {
      console.error('Error loading hierarchical sub-tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId, taskId]);

  const loadTaskDocuments = useCallback(async (taskId) => {
    if (!taskId) return;

    try {
      const { data: documents, error } = await supabase
        .from('task_documents')
        .select('*')
        .eq('subtask_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading task documents:', error);
        return;
      }

      // Transform documents to match the expected format
      const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        fileSize: doc.file_size,
        fileSizeMB: (doc.file_size / (1024 * 1024)).toFixed(2),
        fileType: doc.file_type,
        publicUrl: doc.file_url,
        storagePath: doc.file_path,
        uploadedAt: doc.created_at,
        taskId: taskId,
        metadataSaved: true
      }));

      // Update the state
      setUploadedDocuments(prev => {
        const newMap = new Map(prev);
        newMap.set(taskId, formattedDocuments);
        return newMap;
      });
    } catch (error) {
      console.error('Error loading task documents:', error);
    }
  }, []);

  const deleteDocument = useCallback(async (documentId, storagePath, taskId) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('task-documents')
        .remove([storagePath]);

      if (storageError) {
        console.error('Error deleting from storage:', storageError?.message || storageError);
        // continue to attempt DB delete
      }

      // Delete from database. documentId may be a UUID or a storage path string (legacy).
      let _deletedData = null;
      let dbError = null;

      // Try delete by id first
      try {
        const res = await supabase
          .from('task_documents')
          .delete()
          .eq('id', documentId)
          .select()
          .single();
        _deletedData = res.data;
        dbError = res.error;
      } catch (err) {
        // supabase-js sometimes throws for invalid uuid casts; capture it
        dbError = err;
      }

      // If error indicates invalid UUID or nothing deleted, try delete by file_path
      if (dbError) {
        const msg = dbError?.message || String(dbError);
        if (msg.includes('invalid input syntax for uuid') || msg.includes('invalid input syntax')) {
          // Try delete by storage path
          const res2 = await supabase
            .from('task_documents')
            .delete()
            .eq('file_path', storagePath)
            .select()
            .single();
          _deletedData = res2.data;
          dbError = res2.error;
        }
      }

      if (dbError) {
        console.error('Error deleting from database:', dbError?.message || dbError);
        throw dbError;
      }

      // Update local state (remove any doc that matches deleted id or storage path)
      setUploadedDocuments(prev => {
        const newMap = new Map(prev);
        const taskDocs = newMap.get(taskId) || [];
        const filteredDocs = taskDocs.filter(doc => (doc.id !== documentId && doc.storagePath !== storagePath));
        if (filteredDocs.length === 0) {
          newMap.delete(taskId);
        } else {
          newMap.set(taskId, filteredDocs);
        }
        return newMap;
      });

      alert('✅ Document deleted successfully!');
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('❌ Failed to delete document. Please try again.');
    }
  }, []);

  const loadTeamMembers = useCallback(async () => {
    try {
      const { data: members, error } = await supabase
        .from('team_members')
        .select('id, name')
        .order('name');

      if (error) {
        console.error('Error loading team members:', error);
        return;
      }

      setTeamMembers(members || []);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }, []);

  useEffect(() => {
    loadSubSubTasks();
  }, [boardId, taskId, loadSubSubTasks]);

  useEffect(() => {
    if (selectedTask?.id) {
      loadTaskDocuments(selectedTask.id);
    }
  }, [selectedTask?.id, loadTaskDocuments]);

  useEffect(() => {
    loadTeamMembers();
  }, [loadTeamMembers]);

  const filteredTasks = subSubTasks.filter(task => {
    const matchesSearch = !searchTerm ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
    const matchesAssignee = assigneeFilter === 'all' || task.assigned_to === assigneeFilter;

    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  const getUniqueValues = (field) => {
    const values = [...new Set(subSubTasks.map(task => task[field]).filter(Boolean))];
    return values;
  };

  const buildTree = (tasks) => {
    const taskMap = new Map();
    const rootTasks = [];

    tasks.forEach(task => {
      taskMap.set(task.id, { ...task, children: [] });
    });

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

  const getStats = () => {
    const stats = {
      total: filteredTasks.length,
      byStatus: {},
      byPriority: {},
      byLevel: {},
      overdue: 0
    };

    filteredTasks.forEach(task => {
      // Status stats
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;

      // Priority stats
      stats.byPriority[task.priority] = (stats.byPriority[task.priority] || 0) + 1;

      // Level stats
      stats.byLevel[task.level] = (stats.byLevel[task.level] || 0) + 1;

      // Overdue check
      if (task.due_date && new Date(task.due_date) < new Date() && task.status !== 'Done') {
        stats.overdue++;
      }
    });

    return stats;
  };

  const handleEditTask = (task) => {
    // Open the SubSubTaskInput modal in edit mode
    setTaskToEdit(task);
    setShowSubSubEditModal(true);
  };

  const handleSaveEdit = async () => {
    try {
      const { error } = await supabase
        .from('sub_sub_task')
        .update({
          title: editForm.title,
          description: editForm.description,
          status: editForm.status,
          priority: editForm.priority,
          assigned_to: editForm.assigned_to,
          due_date: editForm.due_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTask);

      if (error) throw error;

      // Reload data
      await loadSubSubTasks();
      setEditingTask(null);
      setEditForm({});
    } catch (error) {
      console.error('Error updating sub-task:', error);
      alert('Failed to update sub-task. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditForm({});
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const { error } = await supabase
        .from('sub_sub_task')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Reload data
      await loadSubSubTasks();
      setShowDeleteConfirm(null);
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    } catch (error) {
      console.error('Error deleting sub-task:', error);
      alert('Failed to delete sub-task. Please try again.');
    }
  };

  const handleFileUpload = async (event, taskId = null) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF, Word document, or image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }

    setUploading(true);

    try {
      // Create a unique filename with task association
      const fileExt = file.name.split('.').pop();
      const taskPrefix = taskId ? `task-${taskId}-` : '';
      const fileName = `${taskPrefix}${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('task-documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-documents')
        .getPublicUrl(fileName);

      // Save document metadata to database
      let insertedDoc = null;
      if (taskId) {
        const { data: subtaskData, error: subtaskError } = await supabase
          .from('sub_sub_task')
          .select('task_id')
          .eq('id', taskId)
          .single();

        if (subtaskError) {
          console.error('Error fetching subtask data:', subtaskError?.message || subtaskError);
        } else {
          const { data: insData, error: insertError } = await supabase
            .from('task_documents')
            .insert({
              subtask_id: taskId,
              task_id: subtaskData.task_id,
              file_name: file.name,
              file_path: fileName,
              file_url: publicUrl,
              file_size: file.size,
              file_type: file.type,
              file_extension: fileExt,
              uploaded_by: null, // You can add user authentication here
              description: null,
              tags: []
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error saving document metadata:', insertError?.message || insertError);
            // Don't fail the upload if metadata save fails
          } else {
            insertedDoc = insData || null;
          }
        }
      }

      // Store document info in state for display
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const documentInfo = {
        // Prefer DB id if available, otherwise fall back to storage path
        id: insertedDoc?.id || data.path,
        fileName: file.name,
        fileSize: file.size,
        fileSizeMB: fileSizeMB,
        fileType: file.type,
        publicUrl: publicUrl,
        storagePath: data.path,
        uploadedAt: insertedDoc?.created_at || new Date().toISOString(),
        taskId: taskId,
        metadataSaved: !!insertedDoc
      };

      // Add to uploaded documents state
      setUploadedDocuments(prev => {
        const newMap = new Map(prev);
        const taskDocs = newMap.get(taskId) || [];
        // Dedupe by storagePath or publicUrl or id
        const exists = taskDocs.some(d => d.storagePath === documentInfo.storagePath || d.publicUrl === documentInfo.publicUrl || d.id === documentInfo.id);
        if (!exists) {
          taskDocs.push(documentInfo);
        } else {
          // replace any matching entry with the new one (ensure DB id used)
          const updated = taskDocs.map(d => (d.storagePath === documentInfo.storagePath || d.publicUrl === documentInfo.publicUrl ? documentInfo : d));
          newMap.set(taskId, updated);
          return newMap;
        }
        newMap.set(taskId, taskDocs);
        return newMap;
      });

      // Show detailed success message
      const uploadTime = new Date().toLocaleString();

      const successMessage = `
🎉 Document Uploaded Successfully!

📄 File Details:
   • Name: ${file.name}
   • Size: ${fileSizeMB} MB
   • Type: ${file.type || 'Unknown'}
   • Uploaded: ${uploadTime}

🔗 Public URL: ${publicUrl}

💾 Database Record: Saved

${taskId ? `📋 Associated with subtask: ${taskId}` : ''}
      `;

      alert(successMessage);

    } catch (error) {
      console.error('Error uploading file:', error);

      // Show detailed error message
      const errorMessage = `
❌ Document Upload Failed

📄 File: ${file.name}
🔍 Error Details: ${error.message}

💡 Possible causes:
   • File too large (max 10MB)
   • Unsupported file type
   • Network connection issues
   • Storage permissions problem

Please try again or contact support if the problem persists.
      `;

      alert(errorMessage);
    } finally {
      setUploading(false);
      // Clear the file input
      event.target.value = '';
    }
  };

  const renderTreeView = () => {
    const treeData = buildTree(filteredTasks);

    const renderTaskNode = (task, level = 0) => {
      const hasChildren = task.children && task.children.length > 0;
      const isExpanded = expandedNodes.has(task.id);
      const indent = level * 24;
      const isEditing = editingTask === task.id;

      return (
        <div key={task.id}>
          <div
            className={`flex items-center py-3 px-4 hover:bg-gray-50 rounded-lg transition-all duration-200 border-l-4 ${
              selectedTask?.id === task.id ? 'border-blue-500 bg-blue-50' : 'border-transparent'
            } ${isEditing ? 'bg-yellow-50 border-yellow-500' : ''}`}
            style={{ paddingLeft: `${16 + indent}px` }}
            onClick={() => !isEditing && setSelectedTask(task)}
          >
            {/* Expand/Collapse */}
            <div className="flex items-center w-6 mr-2">
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(task.id);
                  }}
                  className="p-1 hover:bg-gray-200 rounded"
                  disabled={isEditing}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              ) : (
                <div className="w-4" />
              )}
            </div>

            {/* Status */}
            <div className="flex items-center w-6 mr-3">
              {isEditing ? (
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                  className="w-20 text-xs border border-gray-300 rounded px-1 py-1"
                >
                  {Object.keys(STATUS_COLORS).map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center space-x-1">
                  {STATUS_ICONS[task.status] || <XCircle className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs text-gray-600 hidden sm:inline">{task.status}</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <Layers className="w-4 h-4 text-gray-400 flex-shrink-0" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                    placeholder="Task title"
                  />
                ) : (
                  <span className="font-medium text-gray-900 truncate">{task.title}</span>
                )}
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded flex-shrink-0">
                  Level {task.level}
                </span>
                {task.tasks && (
                  <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded flex-shrink-0">
                    {task.tasks.title}
                  </span>
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-2"
                  placeholder="Task description"
                  rows={2}
                />
              ) : (
                task.description && (
                  <p className="text-sm text-gray-600 mb-2 truncate">{task.description}</p>
                )
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-xs text-gray-500">
                  {isEditing ? (
                    <>
                      <select
                        value={editForm.priority}
                        onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        {Object.keys(PRIORITY_COLORS).map(priority => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                      <select
                        value={editForm.assigned_to}
                        onChange={(e) => setEditForm({...editForm, assigned_to: e.target.value})}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map(member => (
                          <option key={member.id} value={member.name}>{member.name}</option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm({...editForm, due_date: e.target.value})}
                        className="px-2 py-1 border border-gray-300 rounded text-xs"
                      />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-1">
                        <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gray-400'}`} />
                        <span>{task.priority}</span>
                      </div>

                      {task.assigned_to && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3" />
                          <span>{task.assigned_to}</span>
                        </div>
                      )}

                      {task.due_date && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(task.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 text-green-600 hover:bg-green-100 rounded"
                        title="Save changes"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                        title="Cancel editing"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTask(task);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                        title="Edit task"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Upload button hidden */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(task.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Documents Info */}
              {/* Documents info removed from inline task card: documents now shown only in detail panel */}
            </div>
          </div>

          {/* Delete Confirmation */}
          {showDeleteConfirm === task.id && (
            <div className="ml-8 mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 mb-2">
                Are you sure you want to delete "{task.title}"?
                {hasChildren && " This will also delete all child tasks."}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleDeleteTask(task.id)}
                  className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                >
                  Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Children */}
          {hasChildren && isExpanded && (
            <div>
              {task.children.map(child => renderTaskNode(child, level + 1))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="space-y-1">
        {treeData.map(task => renderTaskNode(task))}
      </div>
    );
  };

  const renderListView = () => {
    return (
      <div className="space-y-4">
        {filteredTasks.map(task => {
          const isEditing = editingTask === task.id;
          return (
            <div key={task.id}>
              <div
                className={`p-6 border-2 rounded-2xl hover:shadow-2xl transition-all duration-300 cursor-pointer transform hover:scale-[1.02] ${
                  selectedTask?.id === task.id 
                    ? 'border-indigo-400 bg-gradient-to-r from-indigo-50 to-purple-50 shadow-xl ring-4 ring-indigo-200' 
                    : 'border-indigo-200 bg-white/80 backdrop-blur-sm hover:border-purple-300'
                } ${isEditing ? 'border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50 shadow-xl' : ''}`}
                onClick={() => !isEditing && setSelectedTask(task)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      {isEditing ? (
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm({...editForm, status: e.target.value})}
                          className="border-2 border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white shadow-lg"
                        >
                          {Object.keys(STATUS_COLORS).map(status => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-xl shadow-sm">
                          {STATUS_ICONS[task.status]}
                          <span className="text-sm font-semibold text-indigo-800">{task.status}</span>
                        </div>
                      )}
                      {isEditing ? (
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                          className="flex-1 px-4 py-2 border-2 border-indigo-200 rounded-xl text-sm font-semibold bg-white shadow-lg"
                          placeholder="Task title"
                        />
                      ) : (
                        <h3 className="font-bold text-lg text-indigo-900">{task.title}</h3>
                      )}
                      <span className="text-xs bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 px-3 py-1 rounded-full font-semibold shadow-sm">
                        Level {task.level}
                      </span>
                      {task.tasks && (
                        <span className="text-xs bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 px-3 py-1 rounded-full flex-shrink-0 font-semibold shadow-sm">
                          {task.tasks.title}
                        </span>
                      )}
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                        className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl text-sm mb-4 bg-white shadow-lg"
                        placeholder="Task description"
                        rows={2}
                      />
                    ) : (
                      task.description && (
                        <p className="text-sm text-indigo-700 mb-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">{task.description}</p>
                      )
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm">
                        {isEditing ? (
                          <>
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                              className="border-2 border-indigo-200 rounded-xl px-3 py-2 text-sm bg-white shadow-lg"
                            >
                              {Object.keys(PRIORITY_COLORS).map(priority => (
                                <option key={priority} value={priority}>{priority}</option>
                              ))}
                            </select>
                            <select
                              value={editForm.assigned_to}
                              onChange={(e) => setEditForm({...editForm, assigned_to: e.target.value})}
                              className="px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm bg-white shadow-lg"
                            >
                              <option value="">Unassigned</option>
                              {teamMembers.map(member => (
                                <option key={member.id} value={member.name}>{member.name}</option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={editForm.due_date}
                              onChange={(e) => setEditForm({...editForm, due_date: e.target.value})}
                              className="px-3 py-2 border-2 border-indigo-200 rounded-xl text-sm bg-white shadow-lg"
                            />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center space-x-2 bg-gradient-to-r from-amber-100 to-orange-100 px-3 py-2 rounded-xl">
                              <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gray-400'} shadow-sm`} />
                              <span className="font-semibold text-amber-800">{task.priority}</span>
                            </div>

                            {task.assigned_to && (
                              <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-100 to-pink-100 px-3 py-2 rounded-xl">
                                <User className="w-4 h-4 text-purple-600" />
                                <span className="font-semibold text-purple-800">{task.assigned_to}</span>
                              </div>
                            )}

                            {task.due_date && (
                              <div className="flex items-center space-x-2 bg-gradient-to-r from-rose-100 to-pink-100 px-3 py-2 rounded-xl">
                                <Clock className="w-4 h-4 text-rose-600" />
                                <span className="font-semibold text-rose-800">{new Date(task.due_date).toLocaleDateString()}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={handleSaveEdit}
                              className="p-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
                              title="Save changes"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task);
                              }}
                              className="p-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
                              title="Edit task"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                                input.onchange = (event) => handleFileUpload(event, task.id);
                                input.click();
                              }}
                              className="p-2 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
                              title="Upload document"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(task.id);
                              }}
                              className="p-2 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Documents Info */}
                    {(() => {
                      const taskDocuments = uploadedDocuments.get(task.id) || [];
                      if (taskDocuments.length === 0) return null;

                      return (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="flex items-center space-x-2 text-xs text-gray-600">
                            <Upload className="w-3 h-3" />
                            <span className="font-medium">{taskDocuments.length} document{taskDocuments.length !== 1 ? 's' : ''}</span>
                            <div className="flex space-x-1">
                              {taskDocuments.slice(0, 3).map((doc, index) => (
                                <div key={doc.id || index} className="flex items-center space-x-1 bg-blue-100 hover:bg-blue-200 rounded px-2 py-1 transition-colors">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(doc.publicUrl, '_blank');
                                    }}
                                    className="text-blue-700 truncate max-w-24 cursor-pointer hover:underline"
                                    title={doc.fileName}
                                  >
                                    {doc.fileName.length > 15 ? `${doc.fileName.substring(0, 15)}...` : doc.fileName}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Are you sure you want to delete "${doc.fileName}"? This action cannot be undone.`)) {
                                        deleteDocument(doc.id, doc.storagePath, task.id);
                                      }
                                    }}
                                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors"
                                    title="Delete document"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              {taskDocuments.length > 3 && (
                                <span className="text-gray-500">+{taskDocuments.length - 3} more</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="text-right text-xs text-gray-500 ml-4">
                    <div>Created: {new Date(task.created_at).toLocaleDateString()}</div>
                    {task.updated_at !== task.created_at && (
                      <div>Updated: {new Date(task.updated_at).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete Confirmation */}
              {showDeleteConfirm === task.id && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 mb-2">
                    Are you sure you want to delete "{task.title}"?
                    {task.children && task.children.length > 0 && " This will also delete all child tasks."}
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderKanbanView = () => {
    const tasksByStatus = filteredTasks.reduce((acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    }, {});

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="bg-gray-50 rounded-lg p-4">
            <div className={`flex items-center space-x-2 mb-4 p-2 rounded ${color} text-white`}>
              {STATUS_ICONS[status]}
              <span className="font-medium">{status}</span>
              <span className="text-sm opacity-75">({tasksByStatus[status]?.length || 0})</span>
            </div>

            <div className="space-y-2">
              {(tasksByStatus[status] || []).map(task => {
                const isEditing = editingTask === task.id;
                return (
                  <div key={task.id}>
                    <div
                      className={`bg-white p-3 rounded border cursor-pointer hover:shadow-md transition-all duration-200 ${
                        selectedTask?.id === task.id ? 'border-blue-500 bg-blue-50' : ''
                      } ${isEditing ? 'border-yellow-500 bg-yellow-50' : ''}`}
                      onClick={() => !isEditing && setSelectedTask(task)}
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={(e) => setEditForm({...editForm, title: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-medium"
                            placeholder="Task title"
                          />
                          <textarea
                            value={editForm.description}
                            onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            placeholder="Description"
                            rows={2}
                          />
                          <div className="flex space-x-2">
                            <select
                              value={editForm.priority}
                              onChange={(e) => setEditForm({...editForm, priority: e.target.value})}
                              className="text-xs border border-gray-300 rounded px-1 py-1"
                            >
                              {Object.keys(PRIORITY_COLORS).map(priority => (
                                <option key={priority} value={priority}>{priority}</option>
                              ))}
                            </select>
                            <select
                              value={editForm.assigned_to}
                              onChange={(e) => setEditForm({...editForm, assigned_to: e.target.value})}
                              className="flex-1 px-1 py-1 border border-gray-300 rounded text-xs"
                            >
                              <option value="">Unassigned</option>
                              {teamMembers.map(member => (
                                <option key={member.id} value={member.name}>{member.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex justify-end space-x-1">
                            <button
                              onClick={handleSaveEdit}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="Save"
                            >
                              <Save className="w-3 h-3" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h4 className="font-medium text-sm text-gray-900 mb-1">{task.title}</h4>
                          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <div className="flex items-center space-x-1">
                              {STATUS_ICONS[task.status]}
                              <span>{task.status}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <span>Level {task.level}</span>
                              <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority] || 'bg-gray-400'}`} />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task);
                              }}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                              title="Edit task"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                                input.onchange = (event) => handleFileUpload(event, task.id);
                                input.click();
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                              title="Upload document"
                            >
                              <Upload className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowDeleteConfirm(task.id);
                              }}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="Delete task"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Documents info removed from inline task card: documents now shown only in detail panel */}
                        </>
                      )}
                    </div>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm === task.id && (
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-xs text-red-800 mb-1">
                          Delete "{task.title}"?
                        </p>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStatsView = () => {
    const stats = getStats();

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Tasks */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-600">Total Sub-Tasks</p>
            </div>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
              <p className="text-sm text-gray-600">Overdue Tasks</p>
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
          <div className="space-y-3">
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {STATUS_ICONS[status]}
                  <span className="text-sm text-gray-700">{status}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${STATUS_COLORS[status]}`}
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="space-y-3">
            {Object.entries(stats.byPriority).map(([priority, count]) => (
              <div key={priority} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[priority] || 'bg-gray-400'}`} />
                  <span className="text-sm text-gray-700">{priority}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Level Distribution */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hierarchy Levels</h3>
          <div className="space-y-3">
            {Object.entries(stats.byLevel).sort(([a], [b]) => a - b).map(([level, count]) => (
              <div key={level} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-700">Level {level}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTaskDetail = () => {
    if (!selectedTask) return null;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedTask.title.replace(/\[EDITED \d+\]\s*/g, '').trim()}
            </h2>
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex items-center space-x-2">
                {STATUS_ICONS[selectedTask.status]}
                <span className="text-sm font-medium text-gray-700">{selectedTask.status}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${PRIORITY_COLORS[selectedTask.priority] || 'bg-gray-400'}`} />
                <span className="text-sm text-gray-600">{selectedTask.priority} Priority</span>
              </div>
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">Level {selectedTask.level}</span>
              </div>
              {selectedTask.assigned_to && (
                <div className="flex items-center space-x-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">{selectedTask.assigned_to}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </button>
            <button
              onClick={() => {
                setTaskToEdit(selectedTask);
                setShowSubSubEditModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Edit Task
            </button>
          </div>
        </div>

        {/* Uploaded Documents Section */}
        {(() => {
          const taskDocuments = uploadedDocuments.get(selectedTask.id) || [];
          if (taskDocuments.length === 0) return null;

          return (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Upload className="w-5 h-5 mr-2" />
                  Uploaded Documents
                </h3>
                <button
                  onClick={() => setDocumentsExpanded(!documentsExpanded)}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                  title={documentsExpanded ? "Collapse documents" : "Expand documents"}
                >
                  {documentsExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
              </div>
              {documentsExpanded && (
                <div className="space-y-3">
                  {taskDocuments.map((doc, index) => (
                    <div key={`${doc.id || doc.storagePath || index}`} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="font-medium text-gray-900">{doc.fileName}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {doc.fileSizeMB} MB
                            </span>
                            {doc.metadataSaved && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                ✓ Saved to DB
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div>Type: {doc.fileType || 'Unknown'}</div>
                            <div>Uploaded: {new Date(doc.uploadedAt).toLocaleString()}</div>
                            <div className="flex items-center space-x-2">
                              <span>URL:</span>
                              <a
                                href={doc.publicUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline truncate max-w-xs"
                              >
                                {doc.publicUrl}
                              </a>
                              <button
                                onClick={() => navigator.clipboard.writeText(doc.publicUrl)}
                                className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                                title="Copy URL"
                              >
                                📋
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <a
                            href={doc.publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                          >
                            View
                          </a>
                          <a
                            href={doc.publicUrl}
                            download={doc.fileName}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                          >
                            Download
                          </a>
                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${doc.fileName}"? This action cannot be undone.`)) {
                                deleteDocument(doc.id, doc.storagePath, selectedTask.id);
                              }
                            }}
                            className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                            title="Delete document"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderUploadModal = () => {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border border-slate-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Upload Document</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Select File</label>
              <input
                type="file"
                onChange={(e) => handleFileUpload(e, selectedTask?.id)}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-gradient-to-r file:from-blue-50 file:to-blue-100 file:text-blue-700 hover:file:from-blue-100 hover:file:to-blue-200 transition-all duration-200"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt"
              />
              <p className="text-xs text-slate-500 mt-2">Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF, TXT</p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8">
            <button
              onClick={() => setShowUploadModal(false)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 border-t-blue-600 mb-4"></div>
        <span className="text-slate-600 font-medium">Loading hierarchical sub-tasks...</span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border border-indigo-200 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 border-b border-indigo-300 px-8 py-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
              <TreePine className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">Hierarchical Sub-Tasks</h1>
              <p className="text-sm text-indigo-100 mt-1 drop-shadow">
                {filteredTasks.length} of {subSubTasks.length} tasks • {taskId ? 'Task-specific view' : 'Board overview'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setTaskToEdit(null);
                setShowSubSubEditModal(true);
              }}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Sub-Task
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-indigo-200 px-8 py-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-6">
          {/* Search */}
          <div className="relative flex-1 min-w-80">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-indigo-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search tasks by name, assignee, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white/70 backdrop-blur-sm shadow-lg hover:shadow-xl"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">Filters:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg hover:shadow-xl"
            >
              <option value="all">All Status</option>
              {Object.keys(STATUS_COLORS).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg hover:shadow-xl"
            >
              <option value="all">All Priority</option>
              {Object.keys(PRIORITY_COLORS).map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-4 py-3 border-2 border-indigo-200 rounded-xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg hover:shadow-xl"
            >
              <option value="all">All Assignees</option>
              {getUniqueValues('assigned_to').map(assignee => (
                <option key={assignee} value={assignee}>{assignee}</option>
              ))}
            </select>
          </div>

          {/* View Modes */}
          <div className="flex items-center space-x-3">
            <span className="text-sm font-semibold text-indigo-800">View:</span>
            <div className="flex bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl p-1.5 shadow-lg">
              {Object.entries({
                [VIEW_MODES.TREE]: <TreePine className="w-4 h-4" />,
                [VIEW_MODES.LIST]: <List className="w-4 h-4" />,
                [VIEW_MODES.KANBAN]: <Grid3X3 className="w-4 h-4" />,
                [VIEW_MODES.STATS]: <BarChart3 className="w-4 h-4" />
              }).map(([mode, icon]) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-110 ${
                    viewMode === mode
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl scale-105'
                      : 'text-indigo-600 hover:text-purple-700 hover:bg-white/80'
                  }`}
                  title={mode.charAt(0).toUpperCase() + mode.slice(1) + ' View'}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {viewMode === VIEW_MODES.TREE && renderTreeView()}
          {viewMode === VIEW_MODES.LIST && renderListView()}
          {viewMode === VIEW_MODES.KANBAN && renderKanbanView()}
          {viewMode === VIEW_MODES.STATS && renderStatsView()}

          {filteredTasks.length === 0 && subSubTasks.length > 0 && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <Filter className="w-12 h-12 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-3">No tasks match your filters</h3>
              <p className="text-indigo-600 text-lg">Try adjusting your search or filter criteria</p>
            </div>
          )}

          {subSubTasks.length === 0 && !loading && (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                <TreePine className="w-12 h-12 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-indigo-900 mb-3">No hierarchical sub-tasks yet</h3>
              <p className="text-indigo-600 text-lg">
                {taskId ? 'No hierarchical sub-tasks for this task' : 'Start by adding sub-tasks to organize your work hierarchically'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Task Detail Panel */}
      {selectedTask && (
        <div className="border-t-2 border-indigo-300 p-8 bg-gradient-to-r from-indigo-50 to-purple-50">
          {renderTaskDetail()}
        </div>
      )}

      {/* Upload Document Modal */}
      {showUploadModal && renderUploadModal()}

      {/* Edit Sub-Sub-Task Modal (reuse SubSubTaskInput) */}
      {showSubSubEditModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-white to-indigo-50 rounded-3xl shadow-2xl p-8 w-full max-w-2xl border-2 border-indigo-200">
            <SubSubTaskInput
              taskId={boardId}
              editTask={taskToEdit}
              autoOpen={true}
              initialSelectedParent={taskId ? { id: taskId, type: 'task' } : null}
              onTaskAdded={async () => {
                await loadSubSubTasks();
                setShowSubSubEditModal(false);
                setTaskToEdit(null);
              }}
              onTaskUpdated={async () => {
                await loadSubSubTasks();
                setShowSubSubEditModal(false);
                setTaskToEdit(null);
              }}
              onClose={() => {
                setShowSubSubEditModal(false);
                setTaskToEdit(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Main Component */}
      <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 border-2 border-indigo-200 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 border-b-2 border-indigo-300 px-8 py-6 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
                <TreePine className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">Hierarchical Sub-Tasks</h1>
                <p className="text-indigo-100 drop-shadow">Manage and organize your tasks with hierarchical structure</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setViewMode(VIEW_MODES.LIST)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === VIEW_MODES.LIST ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="List View"
              >
                <List className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode(VIEW_MODES.TREE)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === VIEW_MODES.TREE ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Tree View"
              >
                <TreePine className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode(VIEW_MODES.KANBAN)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === VIEW_MODES.KANBAN ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Kanban View"
              >
                <Grid3X3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode(VIEW_MODES.STATS)}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === VIEW_MODES.STATS ? 'bg-blue-100 text-blue-600' : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Statistics"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white border-b border-slate-200 px-8 py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              {Object.keys(STATUS_COLORS).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Priorities</option>
              {Object.keys(PRIORITY_COLORS).map(priority => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>

            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Assignees</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.name}>{member.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-slate-600">Loading tasks...</span>
            </div>
          ) : (
            <>
              {viewMode === VIEW_MODES.LIST && renderListView()}
              {viewMode === VIEW_MODES.TREE && renderTreeView()}
              {viewMode === VIEW_MODES.KANBAN && renderKanbanView()}
              {viewMode === VIEW_MODES.STATS && renderStatsView()}
            </>
          )}
        </div>

        {/* SubSubTaskInput Modal */}
        {showSubSubEditModal && (
          <SubSubTaskInput
            taskId={taskToEdit?.id}
            boardId={boardId}
            onClose={() => {
              setShowSubSubEditModal(false);
              setTaskToEdit(null);
            }}
            onSave={() => {
              loadSubSubTasks();
              setShowSubSubEditModal(false);
              setTaskToEdit(null);
            }}
            initialData={taskToEdit}
          />
        )}
      </div>
    </>
  );
}