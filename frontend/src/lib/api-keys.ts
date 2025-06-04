// Remove server-only to allow client imports
// import 'server-only'; // Commented out to allow client-side imports

// Types based on the backend API schemas
export interface CreateApiKeyRequest {
  name: string;
}

export interface ApiKey {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  userId: string;
  enabled: boolean;
  requestCount: number;
  remaining: number | null;
  lastRequest: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown> | null;
}

export interface ApiKeyWithKey extends ApiKey {
  key: string;
}

export interface ApiKeysListResponse {
  apiKeys: ApiKey[];
  total: number;
}

export interface DeleteApiKeyResponse {
  success: boolean;
  message: string;
}

// Get backend URL with cross-subdomain cookie support
const getBackendUrl = () =>
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

// Server-side authenticated request helper (uses Next.js cookies)
async function serverApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Dynamic import to avoid issues in client-side bundling
  const { cookies } = await import('next/headers');

  const url = `${getBackendUrl()}${endpoint}`;
  console.log(`🌐 [Server API Request] Making request to: ${url}`);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  console.log(`🌐 [Server API Request] Using server-side cookies`);
  console.log(`🌐 [Server API Request] Options:`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      ...options.headers,
    },
  });

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(cookieHeader && { Cookie: cookieHeader }),
      ...options.headers,
    },
  });

  console.log(
    `🌐 [Server API Response] Status: ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`🌐 [Server API Error] ${response.status}: ${error}`);

    if (response.status === 401) {
      console.error(
        `🔒 [Auth Error] Authentication required - server-side cookies may be missing`
      );
    }

    throw new Error(`API Error ${response.status}: ${error}`);
  }

  const data = await response.json();
  console.log(`🌐 [Server API Success] Response data:`, data);
  return data;
}

// Client-side authenticated request helper (for mutations from client components)
async function clientApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${getBackendUrl()}${endpoint}`;
  console.log(`🌐 [Client API Request] Making request to: ${url}`);
  console.log(`🌐 [Client API Request] Options:`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Cross-subdomain cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  console.log(
    `🌐 [Client API Response] Status: ${response.status} ${response.statusText}`
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`🌐 [Client API Error] ${response.status}: ${error}`);

    if (response.status === 401) {
      console.error(
        `🔒 [Auth Error] Authentication required - user may not be logged in`
      );
    }

    throw new Error(`API Error ${response.status}: ${error}`);
  }

  const data = await response.json();
  console.log(`🌐 [Client API Success] Response data:`, data);
  return data;
}

// Server-side API functions (used by server components)
export const listApiKeys = (): Promise<ApiKeysListResponse> =>
  serverApiRequest('/api-keys/list');

// Client-side API functions (used by client components for mutations)
export const createApiKey = (
  data: CreateApiKeyRequest
): Promise<ApiKeyWithKey> =>
  clientApiRequest('/api-keys/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteApiKey = (id: string): Promise<DeleteApiKeyResponse> =>
  clientApiRequest(`/api-keys/${id}`, { method: 'DELETE' });

// Client-side version of listApiKeys for React Query
export const listApiKeysClient = (): Promise<ApiKeysListResponse> =>
  clientApiRequest('/api-keys/list');
