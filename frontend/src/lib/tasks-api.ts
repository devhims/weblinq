// Direct API client for tasks (no server actions)
export interface Task {
  id: number;
  name: string;
  done: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTaskRequest {
  name: string;
  done: boolean;
}

export interface UpdateTaskRequest {
  name?: string;
  done?: boolean;
}

const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

// Direct API client - follows ApiKeyManager pattern
export const tasksApi = {
  // Fetch all tasks
  async fetchTasks(): Promise<Task[]> {
    console.log('🔍 [API Client] Fetching tasks...');
    const startTime = performance.now();

    const response = await fetch(`${getBackendUrl()}/tasks`, {
      method: 'GET',
      credentials: 'include', // Important: includes auth cookies
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const fetchTime = performance.now() - startTime;
    console.log(`✅ [API Client] Fetch completed in ${fetchTime.toFixed(2)}ms`);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch tasks: ${error}`);
    }

    const tasks = await response.json();
    console.log(`📋 [API Client] Retrieved ${tasks.length} tasks`);
    return tasks;
  },

  // Create a new task
  async createTask(data: CreateTaskRequest): Promise<Task> {
    console.log('🆕 [API Client] Creating task:', data.name);
    const startTime = performance.now();

    const response = await fetch(`${getBackendUrl()}/tasks`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const createTime = performance.now() - startTime;
    console.log(
      `✅ [API Client] Create completed in ${createTime.toFixed(2)}ms`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create task: ${error}`);
    }

    const task = await response.json();
    console.log(`🎉 [API Client] Created task #${task.id}`);
    return task;
  },

  // Update a task
  async updateTask(id: number, data: UpdateTaskRequest): Promise<Task> {
    console.log(`🔄 [API Client] Updating task #${id}:`, data);
    const startTime = performance.now();

    const response = await fetch(`${getBackendUrl()}/tasks/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const updateTime = performance.now() - startTime;
    console.log(
      `✅ [API Client] Update completed in ${updateTime.toFixed(2)}ms`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to update task: ${error}`);
    }

    const task = await response.json();
    console.log(`🔄 [API Client] Updated task #${task.id}`);
    return task;
  },

  // Delete a task
  async deleteTask(id: number): Promise<void> {
    console.log(`🗑️ [API Client] Deleting task #${id}`);
    const startTime = performance.now();

    const response = await fetch(`${getBackendUrl()}/tasks/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const deleteTime = performance.now() - startTime;
    console.log(
      `✅ [API Client] Delete completed in ${deleteTime.toFixed(2)}ms`
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to delete task: ${error}`);
    }

    console.log(`🗑️ [API Client] Deleted task #${id}`);
  },
};

// Server-side API client for server components (no cookies available)
export async function fetchTasksServerSide(): Promise<Task[]> {
  console.log('🔍 [Server Component] Fetching tasks server-side...');
  const startTime = performance.now();

  const response = await fetch(`${getBackendUrl()}/tasks`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store', // Always fetch fresh data
  });

  const fetchTime = performance.now() - startTime;
  console.log(
    `✅ [Server Component] Fetch completed in ${fetchTime.toFixed(2)}ms`
  );

  if (!response.ok) {
    console.warn(
      `⚠️ [Server Component] Failed to fetch tasks: ${response.status}`
    );
    // Return empty array for server component - client will handle auth
    return [];
  }

  const tasks = await response.json();
  console.log(`📋 [Server Component] Retrieved ${tasks.length} tasks`);
  return tasks;
}
