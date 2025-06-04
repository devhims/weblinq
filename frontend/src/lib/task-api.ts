// Task API Client for React Query
// Uses cookie forwarding for authentication

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

// Base API request function with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'
    }${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include session cookies
    }
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

// Task API functions for React Query
export const taskApi = {
  // Get all tasks
  list: (): Promise<Task[]> => apiRequest('/tasks'),

  // Create a new task
  create: (data: CreateTaskRequest): Promise<Task> =>
    apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update a task
  update: (id: number, data: UpdateTaskRequest): Promise<Task> =>
    apiRequest(`/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Delete a task
  delete: (id: number): Promise<void> =>
    apiRequest(`/tasks/${id}`, {
      method: 'DELETE',
    }),
};
