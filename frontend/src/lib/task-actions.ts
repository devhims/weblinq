'use server';

import { revalidateTag, revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

export interface Task {
  id: number;
  name: string;
  done: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type ActionState = {
  success: boolean;
  message: string;
} | null;

// Helper function to get authenticated headers using Better Auth
async function getAuthenticatedFetch() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error('Not authenticated');
  }

  // Get cookies from headers and forward them for the API call
  const headersList = await headers();
  const cookies = headersList.get('cookie');

  return {
    session,
    headers: {
      'Content-Type': 'application/json',
      ...(cookies && { Cookie: cookies }),
    },
  };
}

// Fetch tasks - server-side data fetching
export async function fetchTasks(): Promise<Task[]> {
  try {
    const { headers: authHeaders } = await getAuthenticatedFetch();

    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'GET',
      headers: authHeaders,
      // Add cache tags for revalidation
      next: { tags: ['tasks'] },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Error fetching tasks:', err);
    return [];
  }
}

// Create a new task
export async function createTask(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = formData.get('name') as string;

  if (!name?.trim()) {
    return { success: false, message: 'Task name is required' };
  }

  try {
    const { headers: authHeaders } = await getAuthenticatedFetch();

    const response = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: name.trim(),
        done: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }

    // Revalidate both the cache tag and the path for immediate UI updates
    revalidateTag('tasks');
    revalidatePath('/dashboard');

    return { success: true, message: 'Task created successfully!' };
  } catch (err) {
    console.error('Error creating task:', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to create task',
    };
  }
}

// Toggle task completion
export async function toggleTask(taskId: number, currentDone: boolean) {
  try {
    const { headers: authHeaders } = await getAuthenticatedFetch();

    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        done: !currentDone,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update task: ${response.statusText}`);
    }

    // Revalidate both the cache tag and the path for immediate UI updates
    revalidateTag('tasks');
    revalidatePath('/dashboard');

    return { success: true, message: 'Task updated successfully!' };
  } catch (err) {
    console.error('Error updating task:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to update task'
    );
  }
}

// Delete task
export async function deleteTask(taskId: number) {
  try {
    const { headers: authHeaders } = await getAuthenticatedFetch();

    const response = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete task: ${response.statusText}`);
    }

    // Revalidate both the cache tag and the path for immediate UI updates
    revalidateTag('tasks');
    revalidatePath('/dashboard');

    return { success: true, message: 'Task deleted successfully!' };
  } catch (err) {
    console.error('Error deleting task:', err);
    throw new Error(
      err instanceof Error ? err.message : 'Failed to delete task'
    );
  }
}
