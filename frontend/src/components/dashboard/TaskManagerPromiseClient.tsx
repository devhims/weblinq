'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi, type Task } from '@/lib/task-api';

interface TaskManagerPromiseClientProps {
  tasksPromise: Promise<Task[]>;
}

export function TaskManagerPromiseClient({
  tasksPromise,
}: TaskManagerPromiseClientProps) {
  // Use React's 'use' hook to consume the promise (Next.js 15 pattern)
  const initialTasks = use(tasksPromise);

  const [newTaskName, setNewTaskName] = useState('');
  const queryClient = useQueryClient();

  console.log(
    '🏗️ [Client Component - Promise Pattern] Received initial tasks:',
    {
      count: initialTasks.length,
    }
  );

  // React Query for tasks management - enhanced with promise integration
  const {
    data: tasks = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: ['tasks'],
    queryFn: taskApi.list,
    initialData: initialTasks, // Use promise-resolved data as initial data
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
    gcTime: 10 * 60 * 1000, // 10 minutes - keep in cache longer
    refetchOnWindowFocus: false, // No auto-refetch on window focus
    refetchOnReconnect: false, // No auto-refetch on network reconnect
    refetchInterval: false, // No background polling
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: taskApi.create,
    onMutate: async (newTask) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      const tempTask: Task = {
        id: Date.now(), // Temporary ID
        name: newTask.name,
        done: newTask.done,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      queryClient.setQueryData<Task[]>(['tasks'], (old) => [
        tempTask,
        ...(old || []),
      ]);

      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      queryClient.setQueryData(['tasks'], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onSuccess: () => {
      setNewTaskName('');
    },
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { done: boolean } }) =>
      taskApi.update(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      queryClient.setQueryData<Task[]>(
        ['tasks'],
        (old) =>
          old?.map((task) => (task.id === id ? { ...task, ...data } : task)) ||
          []
      );

      return { previousTasks };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['tasks'], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: taskApi.delete,
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });

      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      queryClient.setQueryData<Task[]>(
        ['tasks'],
        (old) => old?.filter((task) => task.id !== deletedId) || []
      );

      return { previousTasks };
    },
    onError: (err, deletedId, context) => {
      queryClient.setQueryData(['tasks'], context?.previousTasks);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    createTaskMutation.mutate({
      name: newTaskName.trim(),
      done: false,
    });
  };

  // Handle task toggle
  const handleToggleTask = (taskId: number, currentDone: boolean) => {
    updateTaskMutation.mutate({
      id: taskId,
      data: { done: !currentDone },
    });
  };

  // Handle task deletion
  const handleDeleteTask = (taskId: number, taskName: string) => {
    if (!confirm(`Are you sure you want to delete "${taskName}"?`)) {
      return;
    }
    deleteTaskMutation.mutate(taskId);
  };

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-xl font-semibold text-gray-900'>
            Tasks (Promise Pattern)
          </h2>
          <p className='text-sm text-gray-600 mt-1'>
            Using React&apos;s use() hook with server-sent promises
          </p>
        </div>
        {createTaskMutation.isPending && (
          <div className='px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md'>
            Creating...
          </div>
        )}
      </div>

      {/* Error Messages */}
      {queryError && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>
            Failed to load tasks: {queryError.message}
          </p>
        </div>
      )}

      {createTaskMutation.isError && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>
            {createTaskMutation.error.message}
          </p>
        </div>
      )}

      {updateTaskMutation.isError && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>
            Failed to update task: {updateTaskMutation.error.message}
          </p>
        </div>
      )}

      {deleteTaskMutation.isError && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>
            Failed to delete task: {deleteTaskMutation.error.message}
          </p>
        </div>
      )}

      {/* Create new task form */}
      <div className='mb-6'>
        <form onSubmit={handleSubmit} className='flex gap-2'>
          <input
            type='text'
            value={newTaskName}
            onChange={(e) => setNewTaskName(e.target.value)}
            placeholder='Enter task name...'
            className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            disabled={createTaskMutation.isPending}
          />
          <button
            type='submit'
            disabled={createTaskMutation.isPending || !newTaskName.trim()}
            className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {createTaskMutation.isPending ? 'Creating...' : 'Add Task'}
          </button>
        </form>
      </div>

      {/* Task list */}
      <div className='space-y-2'>
        {tasks.length === 0 ? (
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
                onChange={() => handleToggleTask(task.id, task.done)}
                disabled={updateTaskMutation.isPending}
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
                onClick={() => handleDeleteTask(task.id, task.name)}
                disabled={deleteTaskMutation.isPending}
                className='px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50'
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
