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

// Simplified authenticated request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getBackendUrl()}${endpoint}`, {
    ...options,
    credentials: 'include', // Cross-subdomain cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// API functions matching backend route definitions
export const createApiKey = (
  data: CreateApiKeyRequest
): Promise<ApiKeyWithKey> =>
  apiRequest('/api-keys/create', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const listApiKeys = (): Promise<ApiKeysListResponse> =>
  apiRequest('/api-keys/list');

// Backend route expects DELETE /{id}, handler internally calls Better Auth with keyId in body
export const deleteApiKey = (id: string): Promise<DeleteApiKeyResponse> =>
  apiRequest(`/api-keys/${id}`, { method: 'DELETE' });
