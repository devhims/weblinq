# Next.js 15 Data Fetching Architecture Comparison

This document compares two modern patterns for data fetching in Next.js 15 App Router applications: the traditional **Server Component + Suspense** pattern and the newer **Promise Pattern** using React's `use()` hook.

## Overview

Both patterns solve the same core problem: efficiently fetching data on the server and passing it to client components while maintaining good performance and user experience. However, they differ in their approach and trade-offs.

## Pattern 1: Server Component + Suspense (Current Implementation)

### How It Works

```typescript
// Server Component
export async function ApiKeyManagerWithSuspense() {
  // Await the data on the server
  const initialApiKeys = await listApiKeys();

  // Pass resolved data to client component
  return <ApiKeyManagerClient initialApiKeys={initialApiKeys} />;
}

// Usage with Suspense
<Suspense fallback={<ApiKeyManagerLoading />}>
  <ApiKeyManagerWithSuspense />
</Suspense>;
```

### Characteristics

- **Data Resolution**: Server awaits promise before rendering
- **Error Handling**: Server-side try/catch with fallback data
- **Loading States**: Suspense boundary shows skeleton UI
- **Client Hydration**: Client receives resolved data immediately
- **Streaming**: Component streams to client after data is ready

### Benefits

1. **Predictable Behavior**: Data is always resolved when client component mounts
2. **Simple Error Handling**: Server-side try/catch with graceful fallbacks
3. **No Client Loading States**: Client component never sees loading state for initial data
4. **Better SEO**: Fully rendered HTML with actual data
5. **Familiar Pattern**: Traditional React Server Component approach

### Drawbacks

1. **Blocking Rendering**: Server must wait for data before sending any HTML
2. **Waterfall Requests**: If multiple data sources are needed, they typically load sequentially
3. **Less Flexible**: Harder to implement sophisticated loading patterns

## Pattern 2: Promise Pattern (Next.js 15 with `use()`)

### How It Works

```typescript
// Server Component
export async function ApiKeyManagerWithPromise() {
  // Create promise but DON'T await it
  const apiKeysPromise = listApiKeys();

  // Pass promise to client component
  return <ApiKeyManagerPromiseClient apiKeysPromise={apiKeysPromise} />;
}

// Client Component
export function ApiKeyManagerPromiseClient({ apiKeysPromise }) {
  // Use React's use() hook to consume the promise
  const initialApiKeys = use(apiKeysPromise);

  // Component renders with resolved data
  return <div>...</div>;
}
```

### Characteristics

- **Data Resolution**: Client resolves promise using `use()` hook
- **Error Handling**: Client-side error boundaries catch promise rejections
- **Loading States**: Suspense boundary still handles loading, but differently
- **Client Hydration**: Client receives and resolves promise during render
- **Streaming**: HTML structure streams immediately, data fills in when ready

### Benefits

1. **Non-blocking Rendering**: Server sends HTML structure immediately
2. **Parallel Fetching**: Multiple promises can be created and passed simultaneously
3. **Progressive Enhancement**: UI shell loads first, data fills in progressively
4. **Flexible Loading**: More control over loading states and error boundaries
5. **Better Core Web Vitals**: Faster First Contentful Paint (FCP)

### Drawbacks

1. **Complex Error Handling**: Requires proper error boundary setup
2. **Client-side Complexity**: `use()` hook is newer and less familiar
3. **Potential Hydration Issues**: Client must handle promise states correctly
4. **SEO Considerations**: Initial HTML may not contain actual data

## Performance Comparison

### Pattern 1 (Server + Suspense)

```
Server: Fetch data (200ms) → Render with data → Send HTML (complete)
Client: Receive HTML → Hydrate immediately
Total Time to Interactive: ~250ms
```

### Pattern 2 (Promise Pattern)

```
Server: Create promise → Send HTML shell immediately
Client: Receive HTML → Resolve promise (200ms) → Fill data → Interactive
Total Time to Interactive: ~250ms
Time to First Contentful Paint: ~50ms (faster)
```

## When to Use Each Pattern

### Use Server Component + Suspense When:

- **Data is critical for initial render** (e.g., user profiles, essential content)
- **SEO is crucial** and you need fully rendered HTML
- **Simple, predictable loading** patterns are preferred
- **Team familiarity** with traditional SSR patterns
- **Error handling** needs to be server-side

### Use Promise Pattern When:

- **Fast initial page loads** are prioritized (better Core Web Vitals)
- **Progressive enhancement** is desired
- **Multiple independent data sources** need to load in parallel
- **Sophisticated loading states** and error handling are needed
- **Modern React patterns** are embraced by the team

## Real-World Example: Dashboard with Multiple Data Sources

### Server + Suspense Approach

```typescript
export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<TaskManagerLoading />}>
        <TaskManagerWithSuspense />
      </Suspense>

      <Suspense fallback={<ApiKeyManagerLoading />}>
        <ApiKeyManagerWithSuspense />
      </Suspense>

      <Suspense fallback={<AnalyticsLoading />}>
        <AnalyticsWithSuspense />
      </Suspense>
    </div>
  );
}
```

**Result**: Each section loads independently, but server waits for each data fetch.

### Promise Pattern Approach

```typescript
export default function DashboardPage() {
  // All promises start immediately in parallel
  const tasksPromise = fetchTasks();
  const apiKeysPromise = listApiKeys();
  const analyticsPromise = fetchAnalytics();

  return (
    <div>
      <Suspense fallback={<TaskManagerLoading />}>
        <TaskManagerPromiseClient tasksPromise={tasksPromise} />
      </Suspense>

      <Suspense fallback={<ApiKeyManagerLoading />}>
        <ApiKeyManagerPromiseClient apiKeysPromise={apiKeysPromise} />
      </Suspense>

      <Suspense fallback={<AnalyticsLoading />}>
        <AnalyticsPromiseClient analyticsPromise={analyticsPromise} />
      </Suspense>
    </div>
  );
}
```

**Result**: All data fetches start in parallel, HTML shell loads immediately, data fills progressively.

## Implementation in Our Project

Currently, we're using **Pattern 1 (Server + Suspense)** for both TaskManager and ApiKeyManager because:

1. **Consistency**: Both components follow the same architectural pattern
2. **Simplicity**: Easier to understand and maintain
3. **Data Criticality**: Both tasks and API keys are essential for the dashboard
4. **Team Familiarity**: Traditional React patterns are well-understood

However, we've also implemented **Pattern 2 (Promise Pattern)** as `ApiKeyManagerWithPromise` to demonstrate the alternative approach.

## Recommendations

### For This Project

Stick with **Server Component + Suspense** pattern because:

- Data is essential for dashboard functionality
- Simple architecture is maintainable
- Performance difference is minimal for small datasets
- Better developer experience for the team

### For Future Projects

Consider **Promise Pattern** when:

- Dashboard has many independent widgets
- Core Web Vitals scores are critical
- Progressive loading enhances user experience
- Team is comfortable with modern React patterns

## Migration Path

If you want to switch from Pattern 1 to Pattern 2:

1. **Replace server components** to return promises instead of awaited data
2. **Update client components** to use `use()` hook
3. **Add error boundaries** for proper error handling
4. **Test thoroughly** for hydration and loading state issues
5. **Monitor Core Web Vitals** to ensure performance improvements

Both patterns are valid and production-ready. The choice depends on your specific requirements, team preferences, and performance goals.
