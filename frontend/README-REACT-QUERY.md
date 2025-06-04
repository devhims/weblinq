# React Query Guide: From Fundamentals to Implementation

This guide explains React Query (TanStack Query) fundamentals and how we've implemented it in our task management system.

## 🤔 What is React Query and Why Do We Need It?

### The Problem: Server State vs Client State

Before React Query, developers often treated **server data** like **local state**, leading to complex and buggy code.

#### **Client State** (Easy to manage):

```tsx
const [name, setName] = useState('John'); // Lives in component
const [isModalOpen, setIsModalOpen] = useState(false); // UI state
```

#### **Server State** (Complex to manage):

```tsx
// ❌ Traditional approach - treating server data like local state
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);

useEffect(() => {
  setLoading(true);
  fetchTasks()
    .then(setTasks)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

// Problems:
// 1. Manual loading states
// 2. Manual error handling
// 3. No caching - refetch on every mount
// 4. No background updates
// 5. Complex optimistic updates
// 6. Race conditions
// 7. No automatic retries
```

### **React Query's Solution: Treat Server State Differently**

React Query recognizes that **server state** has unique characteristics:

- **Async** - always fetched asynchronously
- **Shared** - multiple components might need the same data
- **Potentially stale** - can become outdated
- **Cacheable** - expensive to refetch
- **Background updatable** - should sync when user returns

## 🎯 React Query Core Concepts

### 1. **Queries** - Reading Data

Queries handle **data fetching** with built-in features:

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['tasks'], // Unique identifier
  queryFn: () => fetchTasks(), // Function that returns a Promise
  staleTime: 60 * 1000, // How long data stays "fresh"
  gcTime: 10 * 60 * 1000, // How long cached data persists
});

// React Query automatically handles:
// ✅ Loading states
// ✅ Error states
// ✅ Caching
// ✅ Background refetching
// ✅ Deduplication
// ✅ Automatic retries
```

### 2. **Mutations** - Changing Data

Mutations handle **data updates** with optimistic updates:

```tsx
const mutation = useMutation({
  mutationFn: createTask,
  onMutate: async (newTask) => {
    // 🚀 Optimistic update - instant UI feedback
    const previousTasks = queryClient.getQueryData(['tasks']);
    queryClient.setQueryData(['tasks'], (old) => [newTask, ...old]);
    return { previousTasks };
  },
  onError: (err, newTask, context) => {
    // 🔄 Rollback on error
    queryClient.setQueryData(['tasks'], context.previousTasks);
  },
  onSettled: () => {
    // 🔄 Refetch to ensure consistency
    queryClient.invalidateQueries(['tasks']);
  },
});
```

### 3. **Query Keys** - Smart Caching

Query keys are how React Query manages its cache:

```tsx
// Different keys = different cache entries
['tasks'][('tasks', userId)][('tasks', { filter: 'completed' })]; // All tasks // Tasks for specific user // Filtered tasks

// Same keys = shared cache
useQuery(['tasks'], fetchTasks); // Component A
useQuery(['tasks'], fetchTasks); // Component B (uses cache!)
```

### 4. **Cache Management**

React Query's cache is **intelligent**:

```tsx
// Automatic cache management
{
  staleTime: 60 * 1000,        // Data is "fresh" for 1 minute
  gcTime: 10 * 60 * 1000,      // Keep in cache for 10 minutes
  refetchOnWindowFocus: true,   // Refetch when user returns
  refetchOnReconnect: true,     // Refetch when internet returns
}
```

## 🏗️ Our Implementation: Task Manager

Let's walk through how we implemented React Query in our task management system.

### **Setup: Query Provider**

```tsx
// src/providers/query-provider.tsx
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Key Points:**

- **Single source of truth**: One QueryClient for the entire app
- **SSR support**: Different client for server vs browser
- **DevTools**: Visual debugging of cache state

### **API Layer: Clean Separation**

```tsx
// src/lib/task-api.ts
export const taskApi = {
  list: (): Promise<Task[]> => apiRequest('/tasks'),
  create: (data: CreateTaskRequest): Promise<Task> =>
    apiRequest('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: UpdateTaskRequest): Promise<Task> =>
    apiRequest(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: number): Promise<void> =>
    apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
};
```

**Benefits:**

- **Testable**: Pure functions, easy to mock
- **Reusable**: Can be used outside React components
- **Type-safe**: TypeScript interfaces ensure consistency

### **Server + Client Rendering Strategy**

```tsx
// Server Component (src/components/dashboard/TaskManager.tsx)
async function TaskManagerContent() {
  // 🏗️ Fetch initial data on server (no loading spinner!)
  const initialTasks = await fetchTasks();
  return <TaskManagerClient initialTasks={initialTasks} />;
}

// Client Component (src/components/dashboard/TaskManagerClient.tsx)
export function TaskManagerClient({ initialTasks }: TaskManagerClientProps) {
  // 🔄 Use server data as initial cache, enable reactive updates
  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: taskApi.list,
    initialData: initialTasks, // No loading spinner on first render!
  });
}
```

**Strategy Benefits:**

- ✅ **Fast initial load**: Server-side data, no loading spinner
- ✅ **Reactive updates**: Client-side mutations with optimistic updates
- ✅ **Best UX**: Instant initial render + smooth interactions

### **Optimistic Updates Pattern**

Our mutations follow React Query's optimistic update pattern:

```tsx
const createTaskMutation = useMutation({
  mutationFn: taskApi.create,

  // 1️⃣ OPTIMISTIC UPDATE (runs immediately)
  onMutate: async (newTask) => {
    // Cancel outgoing queries to avoid conflicts
    await queryClient.cancelQueries(['tasks']);

    // Save current state for potential rollback
    const previousTasks = queryClient.getQueryData(['tasks']);

    // Update cache optimistically (instant UI feedback)
    const tempTask = { id: Date.now(), ...newTask };
    queryClient.setQueryData(['tasks'], (old) => [tempTask, ...old]);

    return { previousTasks }; // Return context for error handling
  },

  // 2️⃣ ERROR HANDLING (if mutation fails)
  onError: (err, newTask, context) => {
    // Rollback to previous state
    queryClient.setQueryData(['tasks'], context?.previousTasks);
    // Show error message to user
  },

  // 3️⃣ CONSISTENCY CHECK (always runs)
  onSettled: () => {
    // Refetch from server to ensure we have latest data
    queryClient.invalidateQueries(['tasks']);
  },

  // 4️⃣ SUCCESS CLEANUP
  onSuccess: () => {
    setNewTaskName(''); // Clear form
  },
});
```

**Flow Explanation:**

1. **User clicks** → Optimistic update → **Instant UI feedback**
2. **API call** → Success or failure
3. **If success** → Keep optimistic update, refetch for consistency
4. **If error** → Rollback optimistic update, show error

## 🚀 Why React Query > Traditional Approaches

### **Before React Query (Complex)**

```tsx
// ❌ Manual state management - lots of boilerplate
const [tasks, setTasks] = useState([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const [createLoading, setCreateLoading] = useState(false);
const [updateLoading, setUpdateLoading] = useState(false);
const [deleteLoading, setDeleteLoading] = useState(false);

// Manual fetch
useEffect(() => {
  setLoading(true);
  fetchTasks()
    .then(setTasks)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);

// Manual create with optimistic update
const createTask = async (newTask) => {
  const tempTask = { id: Date.now(), ...newTask };
  setTasks((prev) => [tempTask, ...prev]); // Optimistic

  try {
    setCreateLoading(true);
    const realTask = await api.createTask(newTask);
    // Replace temp task with real task - complex logic!
    setTasks((prev) =>
      prev.map((task) => (task.id === tempTask.id ? realTask : task))
    );
  } catch (error) {
    // Rollback optimistic update
    setTasks((prev) => prev.filter((task) => task.id !== tempTask.id));
    setError(error.message);
  } finally {
    setCreateLoading(false);
  }
};

// Problems:
// - 15+ lines of boilerplate for each operation
// - Manual loading/error states
// - Complex optimistic update logic
// - No caching between components
// - No background refetching
// - Race condition bugs
```

### **With React Query (Simple)**

```tsx
// ✅ React Query - declarative and robust
const { data: tasks = [], isLoading } = useQuery({
  queryKey: ['tasks'],
  queryFn: taskApi.list,
});

const createTaskMutation = useMutation({
  mutationFn: taskApi.create,
  onMutate: /* optimistic update */,
  onError: /* rollback */,
  onSettled: /* refetch */,
});

// Benefits:
// - 90% less code
// - Built-in loading/error states
// - Automatic optimistic updates
// - Smart caching and deduplication
// - Background sync
// - Zero race conditions
```

## 🛠️ React Query DevTools

The DevTools show you exactly what's happening:

```tsx
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<ReactQueryDevtools initialIsOpen={false} />;
```

**What you can see:**

- 📊 **Cache contents**: All cached queries and their data
- ⏱️ **Query status**: fresh, stale, loading, error
- 🔄 **Mutation status**: pending, success, error
- 📈 **Performance**: Query timing and frequency
- 🐛 **Debugging**: Inspect cache updates in real-time

## 🎯 Best Practices We Follow

### 1. **Smart Query Keys**

```tsx
// ✅ Hierarchical keys for easy invalidation
['tasks'][('tasks', 'list')][('tasks', 'detail', id)][ // All tasks // Task list // Specific task
  ('users', userId, 'tasks')
]; // User's tasks

// Easy invalidation
queryClient.invalidateQueries(['tasks']); // Invalidates all task-related queries
```

### 2. **Proper Error Boundaries**

```tsx
// Mutations should handle their own errors
const mutation = useMutation({
  mutationFn: api.createTask,
  onError: (error) => {
    // Handle error in UI (toast, banner, etc.)
    toast.error(error.message);
  },
});
```

### 3. **Optimistic Updates for Better UX**

```tsx
// Always implement optimistic updates for mutations
// Users expect instant feedback, not loading spinners
```

### 4. **Background Refetching**

```tsx
// Let React Query handle data freshness
{
  staleTime: 60 * 1000,           // 1 minute fresh
  refetchOnWindowFocus: true,      // Sync when user returns
  refetchOnReconnect: true,        // Sync when internet returns
}
```

## 🔄 Server State vs Client State Summary

| Aspect          | Client State          | Server State            |
| --------------- | --------------------- | ----------------------- |
| **Source**      | Component/app         | Remote server           |
| **Persistence** | Memory only           | Database                |
| **Sharing**     | Props/context         | Global cache            |
| **Updates**     | Synchronous           | Asynchronous            |
| **Validation**  | Immediate             | Network dependent       |
| **Caching**     | Manual                | Automatic               |
| **Examples**    | Form inputs, UI state | API data, user profiles |

## 🎉 Benefits in Our Implementation

1. **📱 Better UX**:

   - Instant feedback with optimistic updates
   - No loading spinners on navigation
   - Background data sync

2. **🧹 Cleaner Code**:

   - Eliminated 15+ useState hooks
   - No manual loading/error states
   - Declarative data fetching

3. **🚀 Better Performance**:

   - Automatic deduplication
   - Smart caching
   - Background updates

4. **🛡️ More Robust**:

   - Automatic error handling
   - Race condition prevention
   - Offline support

5. **🔧 Easier Debugging**:
   - DevTools for cache inspection
   - Clear separation of concerns
   - Type-safe APIs

## 🚀 Next Steps

To master React Query:

1. **Experiment** with our implementation
2. **Use DevTools** to understand cache behavior
3. **Read official docs**: [TanStack Query](https://tanstack.com/query)
4. **Practice** optimistic updates patterns
5. **Learn advanced features**: infinite queries, suspense, etc.

React Query transforms how you think about server state - from complex manual management to simple, declarative data synchronization! 🎯
