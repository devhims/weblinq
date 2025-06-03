'use client';

import { useTransition, useOptimistic } from 'react';
import { toggleTask, deleteTask } from '@/lib/task-actions';

interface TaskToggleProps {
  taskId: number;
  done: boolean;
}

export function TaskToggle({ taskId, done }: TaskToggleProps) {
  const [isPending, startTransition] = useTransition();
  const [optimisticDone, setOptimisticDone] = useOptimistic(
    done,
    (currentDone, newDone: boolean) => newDone
  );

  const handleToggle = () => {
    startTransition(async () => {
      // Set optimistic state immediately
      setOptimisticDone(!optimisticDone);

      try {
        // Call server action with the current state (before toggle)
        await toggleTask(taskId, optimisticDone);
      } catch (error) {
        console.error('Failed to toggle task:', error);
        // useOptimistic will automatically revert on error when the transition completes
      }
    });
  };

  return (
    <input
      type='checkbox'
      checked={optimisticDone}
      onChange={handleToggle}
      disabled={isPending}
      className='w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50'
    />
  );
}

interface TaskDeleteProps {
  taskId: number;
  taskName: string;
}

export function TaskDelete({ taskId, taskName }: TaskDeleteProps) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        `Are you sure you want to delete "${taskName}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteTask(taskId);
      } catch (error) {
        console.error('Failed to delete task:', error);
        alert('Failed to delete task. Please try again.');
      }
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className='px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50'
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
