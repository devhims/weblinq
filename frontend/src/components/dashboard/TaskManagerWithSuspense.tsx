import { fetchTasks } from '@/server/task-actions';
import { TaskManagerPromiseClient } from './TaskManagerPromiseClient';

// Server component that creates a promise for streaming (proper Next.js 15 pattern)
export function TaskManagerWithSuspense() {
  console.log(
    '🏗️ [Server Component - Task Streaming] Creating tasks promise...'
  );

  // DON'T await - create promise for streaming
  const tasksPromise = fetchTasks();

  console.log(
    '🏗️ [Server Component - Task Streaming] Passing promise to client for streaming'
  );

  return <TaskManagerPromiseClient tasksPromise={tasksPromise} />;
}
