import { getBackendUrl } from '@/config/env';
import { getSession } from '@/lib/auth-client';

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

// Helper function to create a session token for backend communication
async function getSessionToken(): Promise<string | null> {
  try {
    // Get current session from frontend auth
    const sessionResult = await getSession();

    // Check if we have a valid session with user data
    if (!sessionResult?.data?.user) {
      console.warn('No active session found');
      return null;
    }

    const session = sessionResult.data;

    // Create a temporary token with user info for backend validation
    const tokenData = {
      userId: session.user.id,
      email: session.user.email,
      timestamp: Date.now(),
    };

    // Simple base64 encoding (not for security, just for transport)
    const token = btoa(JSON.stringify(tokenData));
    return token;
  } catch (error) {
    console.error('Failed to get session token:', error);
    return null;
  }
}

// Helper function to make authenticated requests
async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getBackendUrl(endpoint);

  // Get session token for backend validation
  const sessionToken = await getSessionToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Add session token as custom header for backend validation
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken;
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Include cookies for session-based auth
    mode: 'cors', // Explicitly set CORS mode
    headers,
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
