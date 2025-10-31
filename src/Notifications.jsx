import React, { useState, useEffect } from 'react';
import { Bell, X, Check } from 'lucide-react';
import { supabase } from './supabaseClient';

const Notifications = ({ currentUser = 'Current User' }) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    setupRealtimeSubscription();
  }, []);

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_name', currentUser)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    // Subscribe to task changes
    const taskSubscription = supabase
      .channel('task_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, (payload) => {
        handleTaskChange(payload);
      })
      .subscribe();

    // Subscribe to comment changes
    const commentSubscription = supabase
      .channel('comment_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_comments'
      }, (payload) => {
        handleCommentChange(payload);
      })
      .subscribe();

    return () => {
      taskSubscription.unsubscribe();
      commentSubscription.unsubscribe();
    };
  };

  const handleTaskChange = async (payload) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    let message = '';
    let type = 'task_updated';

    switch (eventType) {
      case 'INSERT':
        message = `New task "${newRecord.title}" was created`;
        type = 'task_created';
        break;
      case 'UPDATE':
        if (oldRecord.status !== newRecord.status) {
          message = `Task "${newRecord.title}" status changed to ${newRecord.status}`;
          type = 'task_status_changed';
        } else if (oldRecord.assigned_to !== newRecord.assigned_to) {
          message = `Task "${newRecord.title}" was assigned to ${newRecord.assigned_to || 'Unassigned'}`;
          type = 'task_assigned';
        } else {
          message = `Task "${newRecord.title}" was updated`;
        }
        break;
      case 'DELETE':
        message = `Task "${oldRecord.title}" was deleted`;
        type = 'task_deleted';
        break;
      default:
        return;
    }

    await createNotification(type, message, newRecord?.id || oldRecord?.id);
  };

  const handleCommentChange = async (payload) => {
    const { new: newComment } = payload;

    // Don't notify if the commenter is the current user
    if (newComment.author_name === currentUser) return;

    const { data: task } = await supabase
      .from('tasks')
      .select('title')
      .eq('id', newComment.task_id)
      .single();

    if (task) {
      const message = `${newComment.author_name} commented on "${task.title}"`;
      await createNotification('comment_added', message, newComment.task_id);
    }
  };

  const createNotification = async (type, message, taskId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert([{
          user_name: currentUser,
          type,
          title: getNotificationTitle(type),
          message,
          related_task_id: taskId
        }]);

      if (error) throw error;

      // Reload notifications
      loadNotifications();

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification('Task Management', {
          body: message,
          icon: '/favicon.ico'
        });
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const getNotificationTitle = (type) => {
    const titles = {
      task_created: 'New Task',
      task_updated: 'Task Updated',
      task_status_changed: 'Status Changed',
      task_assigned: 'Task Assigned',
      task_deleted: 'Task Deleted',
      comment_added: 'New Comment'
    };
    return titles[type] || 'Notification';
  };

  const markAsRead = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_name', currentUser)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      const deletedNotif = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (deletedNotif && !deletedNotif.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                    !notification.is_read ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                        )}
                      </div>
                      <p className="text-gray-700 text-sm mb-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(notification.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      {!notification.is_read && (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="text-indigo-600 hover:text-indigo-800 p-1"
                          title="Mark as read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;