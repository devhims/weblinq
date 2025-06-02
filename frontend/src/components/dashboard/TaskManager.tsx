'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: number;
  name: string;
  done: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [creating, setCreating] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787';

  // Fetch tasks
  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.statusText}`);
      }

      const data = await response.json();
      setTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Create a new task
  const createTask = async () => {
    if (!newTaskName.trim()) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTaskName.trim(),
          done: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }

      const newTask = await response.json();
      setTasks((prev) => [newTask, ...prev]);
      setNewTaskName('');
      setSuccess('Task created successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  // Toggle task completion
  const toggleTask = async (taskId: number, currentDone: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          done: !currentDone,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update task: ${response.statusText}`);
      }

      const updatedTask = await response.json();
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? updatedTask : task))
      );
      setSuccess('Task updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
    }
  };

  // Delete task
  const deleteTask = async (taskId: number, taskName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${taskName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete task: ${response.statusText}`);
      }

      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setSuccess('Task deleted successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete task');
    }
  };

  // Load tasks on component mount
  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-xl font-semibold text-gray-900'>Task Manager</h2>
          <p className='text-sm text-gray-600 mt-1'>
            Powered by Durable Objects for per-user task isolation
          </p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className='px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50'
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {success && (
        <div className='mb-4 p-3 bg-green-50 border border-green-200 rounded-md'>
          <p className='text-green-600 text-sm'>{success}</p>
        </div>
      )}

      {/* Create new task */}
      <div className='mb-6'>
        <div className='flex gap-2'>
          <input
            type='text'
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder='Enter task name...'
            className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            onKeyPress={(e) => e.key === 'Enter' && createTask()}
          />
          <button
            onClick={createTask}
            disabled={creating || !newTaskName.trim()}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {creating ? 'Creating...' : 'Add Task'}
          </button>
        </div>
      </div>

      {/* Task list */}
      <div className='space-y-2'>
        {loading && tasks.length === 0 ? (
          <p className='text-gray-500 text-center py-4'>Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className='text-gray-500 text-center py-4'>
            No tasks yet. Create your first task above!
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className='flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50'
            >
              <input
                type='checkbox'
                checked={task.done}
                onChange={() => toggleTask(task.id, task.done)}
                className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500'
              />
              <span
                className={`flex-1 ${
                  task.done ? 'line-through text-gray-500' : 'text-gray-900'
                }`}
              >
                {task.name}
              </span>
              <span className='text-xs text-gray-400 font-mono'>
                #{task.id}
              </span>
              <button
                onClick={() => deleteTask(task.id, task.name)}
                className='px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded'
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {tasks.length > 0 && (
        <div className='mt-6 pt-4 border-t border-gray-200'>
          <div className='grid grid-cols-3 gap-4 text-center'>
            <div>
              <div className='text-2xl font-bold text-blue-600'>
                {tasks.length}
              </div>
              <div className='text-xs text-gray-500'>Total</div>
            </div>
            <div>
              <div className='text-2xl font-bold text-green-600'>
                {tasks.filter((t) => t.done).length}
              </div>
              <div className='text-xs text-gray-500'>Completed</div>
            </div>
            <div>
              <div className='text-2xl font-bold text-orange-600'>
                {tasks.filter((t) => !t.done).length}
              </div>
              <div className='text-xs text-gray-500'>Pending</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
