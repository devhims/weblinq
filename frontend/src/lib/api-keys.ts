// Remove server-only to allow client imports
// import 'server-only'; // Commented out to allow client-side imports

import { parseErrorResponse, makeApiRequest } from './error-utils';
import { isVercelPreview, getApiKeyFromStorage } from '@/lib/utils';

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
const getBackendUrl = () => process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

// Server-side authenticated request helper (uses Next.js cookies)
async function serverApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Dynamic import to avoid issues in client-side bundling
  const { cookies } = await import('next/headers');

  const url = `${getBackendUrl()}${endpoint}`;
  console.log(`🌐 [Server API Request] Making request to: ${url}`);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  // Prepare headers with potential API key auth for preview environments
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookieHeader && { Cookie: cookieHeader }),
  };

  // Merge existing headers safely
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Add API key for preview environments (server-side check)
  // Note: isVercelPreview() relies on window.location, so we check environment variables instead
  const isPreview = process.env.VERCEL_ENV === 'preview';
  if (isPreview) {
    // For server-side, we can't access localStorage directly, so we rely on client-side requests
    // or environment variables. This is primarily for client-side usage.
    console.log(`🌐 [Server API Request] Preview environment detected`);
  }

  console.log(`🌐 [Server API Request] Using server-side cookies`);
  console.log(`🌐 [Server API Request] Options:`, {
    method: options.method || 'GET',
    headers,
  });

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`🌐 [Server API Response] Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    console.error(`🌐 [Server API Error] ${response.status}: ${apiError.message}`, {
      code: apiError.code,
      requestId: apiError.requestId,
    });

    if (response.status === 401) {
      console.error(`🔒 [Auth Error] Authentication required - server-side cookies may be missing`);
    }

    throw apiError;
  }

  const data = await response.json();
  console.log(`🌐 [Server API Success] Response data:`, data);
  return data;
}

// Client-side authenticated request helper (for mutations from client components)
async function clientApiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${getBackendUrl()}${endpoint}`;
  console.log(`🌐 [Client API Request] Making request to: ${url}`);

  // Prepare headers with potential API key auth for preview environments
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers safely
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Add API key for preview environments
  if (isVercelPreview()) {
    const apiKey = getApiKeyFromStorage();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      console.log(`🌐 [Client API Request] Using API key authentication for preview environment`);
    }
  }

  console.log(`🌐 [Client API Request] Options:`, {
    method: options.method || 'GET',
    credentials: 'include',
    headers,
  });

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Cross-subdomain cookies
    headers,
  });

  console.log(`🌐 [Client API Response] Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    console.error(`🌐 [Client API Error] ${response.status}: ${apiError.message}`, {
      code: apiError.code,
      requestId: apiError.requestId,
    });

    if (response.status === 401) {
      console.error(`🔒 [Auth Error] Authentication required - user may not be logged in`);
    }

    throw apiError;
  }

  const data = await response.json();
  console.log(`🌐 [Client API Success] Response data:`, data);
  return data;
}

// Server-side API functions (used by server components)
export const listApiKeys = (): Promise<ApiKeysListResponse> => serverApiRequest('/v1/api-keys/list');

// Client-side API functions (used by client components for mutations)
export const createApiKey = (data: CreateApiKeyRequest): Promise<ApiKeyWithKey> =>
  clientApiRequest('/v1/api-keys/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteApiKey = (id: string): Promise<DeleteApiKeyResponse> =>
  clientApiRequest(`/v1/api-keys/${id}`, { method: 'DELETE' });

// Client-side version of listApiKeys for React Query
export const listApiKeysClient = (): Promise<ApiKeysListResponse> => clientApiRequest('/v1/api-keys/list');
