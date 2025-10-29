import React, { useState, useEffect } from 'react';
import { Plus, X, ChevronDown, ChevronRight, Layers } from 'lucide-react';
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

export default function SubSubTaskInput({ taskId, onClose, onTaskAdded, autoOpen = false, editTask = null, onTaskUpdated, initialSelectedParent = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'Not Started',
    priority: 'Medium',
    assigned_to: '',
    due_date: '',
    tags: []
  });
  const [parentOptions, setParentOptions] = useState([]);
  const [selectedParent, setSelectedParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showParentSelector, setShowParentSelector] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    if (taskId) {
      loadParentOptions();
    }
    loadTeamMembers();
  }, [taskId]);

  // If parent options load and we are editing, try to resolve the selected parent
  useEffect(() => {
    if (editTask && parentOptions && parentOptions.length > 0) {
      if (editTask.parent_sub_task_id === null) {
        const taskOption = parentOptions.find(opt => opt.type === 'task');
        if (taskOption) setSelectedParent(taskOption);
      } else {
        const match = parentOptions.find(opt => String(opt.id) === String(editTask.parent_sub_task_id));
        if (match) setSelectedParent(match);
      }
    } else if (!editTask && initialSelectedParent && parentOptions && parentOptions.length > 0) {
      // For new tasks, if initialSelectedParent is provided, try to find and select it
      if (initialSelectedParent.type === 'task') {
        const taskOption = parentOptions.find(opt => opt.type === 'task' && String(opt.id) === String(initialSelectedParent.id));
        if (taskOption) setSelectedParent(taskOption);
      } else {
        const match = parentOptions.find(opt => String(opt.id) === String(initialSelectedParent.id));
        if (match) setSelectedParent(match);
      }
    }
  }, [parentOptions, editTask, initialSelectedParent]);

  // If parent requests the input to open (e.g., when rendered inside a modal), open it on mount
  useEffect(() => {
    if (autoOpen) setIsOpen(true);

    // If an editTask is provided, open the form and populate fields
    if (editTask) {
      setIsOpen(true);
      setFormData({
        title: editTask.title || '',
        description: editTask.description || '',
        status: editTask.status || 'Not Started',
        priority: editTask.priority || 'Medium',
        assigned_to: editTask.assigned_to || '',
        due_date: editTask.due_date || '',
        tags: editTask.tags || []
      });
      // parent selection will be resolved after parentOptions are loaded
      if (editTask.parent_sub_task_id === null) {
        setSelectedParent({ id: 'task', title: 'Task Root', type: 'task', level: 0 });
      }
    }
  }, [autoOpen, editTask]);

  const loadParentOptions = async () => {
    try {
      if (!taskId) {
        // If no taskId/boardId provided, load all tasks from all boards
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('id, title')
          .order('title');

        if (allTasks && allTasks.length > 0) {
          const parentOptions = allTasks.map(task => ({
            id: task.id,
            title: task.title,
            type: 'task',
            level: 0
          }));
          setParentOptions(parentOptions);
        }
        return;
      }

      // Load tasks for this board (if taskId is actually a boardId)
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('board_id', taskId)
        .order('title');

      if (taskData && taskData.length > 0) {
        // We're in board mode - load all tasks as potential parents
        const parentOptions = taskData.map(task => ({
          id: task.id,
          title: task.title,
          type: 'task',
          level: 0
        }));

        // Also load existing sub_tasks and sub_sub_tasks for all these tasks
        const taskIds = taskData.map(t => t.id);
        
        const { data: subTasks } = await supabase
          .from('sub_tasks')
          .select('id, title, level, task_id')
          .in('task_id', taskIds)
          .order('level', { ascending: true })
          .order('order_index', { ascending: true });

        const { data: subSubTasks } = await supabase
          .from('sub_sub_task')
          .select('id, title, level, parent_sub_task_id, task_id')
          .in('task_id', taskIds)
          .order('level', { ascending: true })
          .order('order_index', { ascending: true });

        // Build hierarchical options
        const allOptions = [...parentOptions];

        if (subTasks) {
          subTasks.forEach(subTask => {
            allOptions.push({
              id: subTask.id,
              title: subTask.title,
              type: 'sub_task',
              level: subTask.level,
              task_id: subTask.task_id
            });
          });
        }

        if (subSubTasks) {
          subSubTasks.forEach(subSubTask => {
            allOptions.push({
              id: subSubTask.id,
              title: subSubTask.title,
              type: 'sub_sub_task',
              level: subSubTask.level,
              parent_id: subSubTask.parent_sub_task_id,
              task_id: subSubTask.task_id
            });
          });
        }

        setParentOptions(allOptions);
        return;
      }

      // Fallback: original logic for single task mode
      const { data: singleTaskData } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', taskId)
        .single();

      if (singleTaskData) {
        // Load existing sub_tasks for this task
        const { data: subTasks, error: subTasksError } = await supabase
          .from('sub_tasks')
          .select('id, title, level')
          .eq('task_id', taskId)
          .order('level', { ascending: true })
          .order('order_index', { ascending: true });

        if (subTasksError) {
          console.error('Error loading sub_tasks:', subTasksError?.message || subTasksError, subTasksError?.details || 'no details');
        }

        // Load existing sub_sub_tasks for this task
        const { data: subSubTasks, error: subSubTasksError } = await supabase
          .from('sub_sub_task')
          .select('id, title, level, parent_sub_task_id')
          .eq('task_id', taskId)
          .order('level', { ascending: true })
          .order('order_index', { ascending: true });

        if (subSubTasksError) {
          console.error('Error loading sub_sub_task:', subSubTasksError?.message || subSubTasksError, subSubTasksError?.details || 'no details');
        }

        // Combine all parent options
        const options = [
          { id: 'task', title: taskData.title, type: 'task', level: 0 },
          ...(subTasks || []).map(st => ({ ...st, type: 'sub_task' })),
          ...(subSubTasks || []).map(sst => ({ ...sst, type: 'sub_sub_task' }))
        ];

        setParentOptions(options);
      }
    } catch (error) {
      console.error('Error loading parent options:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, color')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading team members:', error?.message || error);
      } else {
        setTeamMembers(data || []);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const calculateLevel = (parent) => {
    if (!parent || parent.type === 'task') return 1;
    return parent.level + 1;
  };

  const getNextOrderIndex = async (parentId, parentType) => {
    try {
      let query = supabase.from('sub_sub_task').select('order_index');

      if (parentType === 'task') {
        // For task parents, find the task_id
        const parentTaskId = parentId; // parentId is the task id
        query = query.eq('task_id', parentTaskId).is('parent_sub_task_id', null);
      } else {
        query = query.eq('parent_sub_task_id', parentId);
      }

      const { data } = await query
        .order('order_index', { ascending: false })
        .limit(1);

      return data && data.length > 0 ? data[0].order_index + 1 : 1;
    } catch (error) {
      console.error('Error getting next order index:', error);
      return 1;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
        // If editing an existing sub-sub-task, perform update instead of insert
        if (editTask) {
          const updateData = {
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            status: formData.status,
            priority: formData.priority,
            assigned_to: formData.assigned_to || null,
            due_date: formData.due_date || null,
            tags: formData.tags.length > 0 ? formData.tags : null,
            updated_at: new Date().toISOString()
          };

          const { data, error } = await supabase
            .from('sub_sub_task')
            .update(updateData)
            .eq('id', editTask.id)
            .select()
            .single();

          if (error) throw error;

          // Notify parent about update
          if (onTaskUpdated) onTaskUpdated(data);

          if (onClose) onClose();

          setLoading(false);
          return;
        }
      const level = calculateLevel(selectedParent);
      const orderIndex = await getNextOrderIndex(
        selectedParent?.id,
        selectedParent?.type
      );

      // Determine the correct task_id based on selectedParent
      let actualTaskId = taskId;
      if (selectedParent) {
        if (selectedParent.type === 'task') {
          actualTaskId = selectedParent.id;
        } else if (selectedParent.task_id) {
          actualTaskId = selectedParent.task_id;
        }
      }

      const subSubTaskData = {
        task_id: actualTaskId,
        parent_sub_task_id: selectedParent?.type === 'task' ? null : selectedParent?.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        status: formData.status,
        priority: formData.priority,
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        tags: formData.tags.length > 0 ? formData.tags : null,
        level: level,
        order_index: orderIndex
      };

      const { data, error } = await supabase
        .from('sub_sub_task')
        .insert(subSubTaskData)
        .select()
        .single();

      if (error) throw error;

      // Reset form
      setFormData({
        title: '',
        description: '',
        status: 'Not Started',
        priority: 'Medium',
        assigned_to: '',
        due_date: '',
        tags: []
      });
      setSelectedParent(null);
      setIsOpen(false);

      // Notify parent component
      if (onTaskAdded) {
        onTaskAdded(data);
      } else if (onClose) {
        // Only call onClose if onTaskAdded is not provided (for inline usage)
        try {
          onClose();
        } catch {
          // ignore
        }
      }

    } catch (error) {
      console.error('Error creating sub-sub-task:', error);
      alert('Error creating sub-sub-task: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderParentSelector = () => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Parent Task (Optional)
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowParentSelector(!showParentSelector)}
          className="w-full p-2 border border-gray-300 rounded-md text-left flex items-center justify-between hover:border-gray-400"
        >
          <span className="text-sm">
            {selectedParent ? (
              <span className="flex items-center">
                <Layers className="w-5 h-5 mr-2 text-gray-500" />
                {selectedParent.title}
                <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                  Level {selectedParent.level || 0}
                </span>
              </span>
            ) : (
              'Select parent task (optional)'
            )}
          </span>
          {showParentSelector ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        {showParentSelector && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setSelectedParent(null);
                setShowParentSelector(false);
              }}
              className="w-full p-2 text-left hover:bg-gray-50 text-sm"
            >
              No parent (root level)
            </button>
            {parentOptions.map((option) => (
              <button
                key={`${option.type}-${option.id}`}
                type="button"
                onClick={() => {
                  setSelectedParent(option);
                  setShowParentSelector(false);
                }}
                className="w-full p-2 text-left hover:bg-gray-50 text-sm flex items-center"
              >
                <Layers className="w-5 h-5 mr-2 text-gray-500" />
                <span className="truncate">{option.title}</span>
                <span className="ml-auto text-xs bg-gray-100 px-2 py-1 rounded">
                  Level {option.level || 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (!isOpen && !autoOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Sub-Sub Task
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-indigo-50 border-2 border-indigo-200 rounded-3xl p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-2xl font-bold text-indigo-900 flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
            <Layers className="w-5 h-5 text-white" />
          </div>
          {editTask ? 'Edit Hierarchical Sub-Task' : 'Add Hierarchical Sub-Task'}
        </h3>
        <button
          onClick={() => {
            if (onClose) onClose();
            else setIsOpen(false);
          }}
          className="text-indigo-400 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:to-rose-600 p-3 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-110"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderParentSelector()}

        <div>
          <label className="block text-sm font-bold text-indigo-800 mb-3">
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 font-medium"
            placeholder="Enter sub-task title"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-indigo-800 mb-3">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 resize-none"
            rows={4}
            placeholder="Enter description (optional)"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-indigo-800 mb-3">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 font-medium"
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-indigo-800 mb-3">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 font-medium"
            >
              {PRIORITY_OPTIONS.map(option => (
                <option key={option.label} value={option.label}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-bold text-indigo-800 mb-3">
              Assigned To
            </label>
            <select
              value={formData.assigned_to}
              onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
              className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 font-medium"
            >
              <option value="">Select assignee...</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-indigo-800 mb-3">
              Due Date
            </label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="w-full px-4 py-4 border-2 border-indigo-200 rounded-2xl focus:ring-4 focus:ring-indigo-300 focus:border-indigo-400 transition-all duration-300 bg-white shadow-lg text-indigo-900 font-medium"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t-2 border-indigo-100">
          <button
            type="button"
            onClick={() => {
              if (onClose) onClose();
              else setIsOpen(false);
            }}
            className="px-8 py-3 text-indigo-700 font-semibold border-2 border-indigo-200 rounded-2xl hover:bg-gradient-to-r hover:from-gray-500 hover:to-slate-600 hover:text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.title.trim()}
            className="px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-2xl transition-all duration-300 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none"
          >
            {loading ? (editTask ? 'Saving...' : 'Creating...') : (editTask ? 'Save Changes' : 'Create Sub-Task')}
          </button>
        </div>
      </form>
    </div>
  );
}