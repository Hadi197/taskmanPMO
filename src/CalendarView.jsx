import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';

const CalendarView = ({ tasks = [], onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const getTasksForDate = (date) => {
    if (!date) return [];
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  const getTaskStatusColor = (status) => {
    const colors = {
      'Not Started': 'bg-slate-100 border-slate-300 text-slate-800',
      'Working on it': 'bg-amber-100 border-amber-300 text-amber-800',
      'Stuck': 'bg-red-100 border-red-300 text-red-800',
      'Done': 'bg-emerald-100 border-emerald-300 text-emerald-800',
      'Review': 'bg-indigo-100 border-indigo-300 text-indigo-800'
    };
    return colors[status] || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const isToday = (date) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toDateString() === selectedDate.toDateString();
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Calendar className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-900">Calendar View</h2>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-semibold text-gray-900 min-w-48 text-center">
              {formatMonthYear(currentDate)}
            </h3>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-6">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const dayTasks = getTasksForDate(date);
            const hasTasks = dayTasks.length > 0;

            return (
              <div
                key={index}
                className={`
                  min-h-24 p-2 border border-gray-200 rounded-lg cursor-pointer transition-all
                  ${date ? 'hover:bg-gray-50 hover:border-indigo-300' : 'bg-gray-50'}
                  ${isToday(date) ? 'bg-indigo-50 border-indigo-300' : ''}
                  ${isSelected(date) ? 'ring-2 ring-indigo-500' : ''}
                `}
                onClick={() => date && setSelectedDate(date)}
              >
                {date && (
                  <>
                    <div className={`
                      text-sm font-medium mb-1
                      ${isToday(date) ? 'text-indigo-600' : 'text-gray-900'}
                    `}>
                      {date.getDate()}
                    </div>

                    {/* Tasks for this day */}
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map(task => (
                        <div
                          key={task.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTaskClick && onTaskClick(task);
                          }}
                          className={`
                            text-xs p-1 rounded border cursor-pointer hover:opacity-80 transition-opacity
                            ${getTaskStatusColor(task.status)}
                          `}
                          title={`${task.name || task.title} - ${task.status}`}
                        >
                          <div className="truncate font-medium">
                            {task.name || task.title}
                          </div>
                        </div>
                      ))}

                      {dayTasks.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayTasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Date Details */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-3">
              Tasks for {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h4>

            {getTasksForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500 text-sm">No tasks scheduled for this date</p>
            ) : (
              <div className="space-y-2">
                {getTasksForDate(selectedDate).map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick && onTaskClick(task)}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-3 h-3 rounded-full ${getTaskStatusColor(task.status).split(' ')[0]}`} />
                        <span className="font-medium text-gray-900">
                          {task.name || task.title}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {task.person && `👤 ${task.person}`}
                        {task.person && task.notes && ' • '}
                        {task.notes && task.notes.length > 50
                          ? `${task.notes.substring(0, 50)}...`
                          : task.notes
                        }
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}>
                      {task.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-900 mb-3">Status Legend</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries({
              'Not Started': 'bg-slate-100 border-slate-300 text-slate-800',
              'Working on it': 'bg-amber-100 border-amber-300 text-amber-800',
              'Stuck': 'bg-red-100 border-red-300 text-red-800',
              'Done': 'bg-emerald-100 border-emerald-300 text-emerald-800',
              'Review': 'bg-indigo-100 border-indigo-300 text-indigo-800'
            }).map(([status, classes]) => (
              <div key={status} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${classes.split(' ')[0]}`} />
                <span className="text-sm text-gray-600">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarView;