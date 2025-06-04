import { fetchTasks, type Task } from '@/server/task-actions';
import { TaskManagerClient } from './TaskManagerClient';

// Server component that fetches initial data for the TaskManagerClient
export async function TaskManagerWithSuspense() {
  console.log('🏗️ [Server Component] Fetching initial tasks...');

  let initialTasks: Task[];
  try {
    // Fetch initial data using server action (no caching)
    initialTasks = await fetchTasks();
    console.log(
      `🏗️ [Server Component] Fetched ${initialTasks.length} initial tasks`
    );
  } catch (error) {
    console.warn(
      '⚠️ [Server Component] Failed to fetch initial tasks, falling back to empty array:',
      error
    );
    initialTasks = [];
  }

  return <TaskManagerClient initialTasks={initialTasks} />;
}
