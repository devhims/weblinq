import { getBackendUrl } from '@/config/env';

// Types based on the backend API schemas
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

export interface CreateApiKeyRequest {
  name: string;
}

export interface ApiKeysListResponse {
  apiKeys: ApiKey[];
  total: number;
}

export interface DeleteApiKeyResponse {
  success: boolean;
  message: string;
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getBackendUrl(endpoint);

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for session-based auth
    mode: 'cors', // Explicitly set CORS mode
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return response.json();
}

// API Key service functions
export const apiKeyService = {
  /**
   * Create a new API key
   */
  async createApiKey(data: CreateApiKeyRequest): Promise<ApiKeyWithKey> {
    return makeAuthenticatedRequest<ApiKeyWithKey>('/api-keys/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * List all API keys for the authenticated user
   */
  async listApiKeys(): Promise<ApiKeysListResponse> {
    return makeAuthenticatedRequest<ApiKeysListResponse>('/api-keys/list');
  },

  /**
   * Get details of a specific API key
   */
  async getApiKey(id: string): Promise<ApiKey> {
    return makeAuthenticatedRequest<ApiKey>(`/api-keys/${id}`);
  },

  /**
   * Delete an API key
   */
  async deleteApiKey(id: string): Promise<DeleteApiKeyResponse> {
    return makeAuthenticatedRequest<DeleteApiKeyResponse>(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  },
};
