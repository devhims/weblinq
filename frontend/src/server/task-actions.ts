import 'server-only';

import { cookies } from 'next/headers';

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

export interface ActionState {
  success: boolean;
  message: string;
}

// Get backend URL
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

// Helper to make authenticated API requests (no auth check, just forward cookies)
async function authenticatedRequest<T>(
  endpoint: string,
  cookieHeader: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`🚀 [Server Action] Starting request to ${endpoint}`);
  const startTime = performance.now();

  const response = await fetch(`${getBackendUrl()}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader && { Cookie: cookieHeader }),
      ...options.headers,
    },
  });

  const requestTime = performance.now() - startTime;
  console.log(
    `✅ [Server Action] Request completed in ${requestTime.toFixed(2)}ms`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  // Handle empty responses (like DELETE)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return null as T;
}

// Simple server action to fetch tasks (no caching)
export async function fetchTasks(): Promise<Task[]> {
  console.log('📋 [Server Action] Fetching fresh tasks (no cache)...');

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  try {
    const tasks = await authenticatedRequest<Task[]>('/tasks', cookieHeader);
    console.log(`📋 [Server Action] Retrieved ${tasks.length} fresh tasks`);
    return tasks;
  } catch (error) {
    console.error('❌ [Server Action] Failed to fetch tasks:', error);
    throw error;
  }
}

// Server actions for form-based mutations (optional - keep for form compatibility)
export async function createTaskAction(data: CreateTaskRequest): Promise<Task> {
  try {
    console.log('🆕 [Server Action] Creating task:', data.name);

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const task = await authenticatedRequest<Task>('/tasks', cookieHeader, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    console.log(`🎉 [Server Action] Created task #${task.id}`);
    return task;
  } catch (error) {
    console.error('❌ [Server Action] Failed to create task:', error);
    throw error;
  }
}

export async function updateTaskAction(
  id: number,
  data: UpdateTaskRequest
): Promise<Task> {
  try {
    console.log(`🔄 [Server Action] Updating task #${id}:`, data);

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const task = await authenticatedRequest<Task>(
      `/tasks/${id}`,
      cookieHeader,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );

    console.log(`🔄 [Server Action] Updated task #${task.id}`);
    return task;
  } catch (error) {
    console.error('❌ [Server Action] Failed to update task:', error);
    throw error;
  }
}

export async function deleteTaskAction(id: number): Promise<void> {
  try {
    console.log(`🗑️ [Server Action] Deleting task #${id}`);

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    await authenticatedRequest<void>(`/tasks/${id}`, cookieHeader, {
      method: 'DELETE',
    });

    console.log(`🗑️ [Server Action] Deleted task #${id}`);
  } catch (error) {
    console.error('❌ [Server Action] Failed to delete task:', error);
    throw error;
  }
}

// Form-compatible server action for createTask (returns ActionState)
export async function createTask(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  try {
    const name = formData.get('name') as string;
    if (!name?.trim()) {
      return {
        success: false,
        message: 'Task name is required',
      };
    }

    const task = await createTaskAction({
      name: name.trim(),
      done: false,
    });

    return {
      success: true,
      message: `Task "${task.name}" created successfully!`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create task',
    };
  }
}
