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
}

// ✅ SUBDOMAIN SOLUTION: Direct backend API calls with cross-subdomain cookies
async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Call backend API directly - subdomain cookies will be shared automatically
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
  const apiUrl = `${backendUrl}${endpoint}`;

  console.log('🚀 Making direct request to backend:', apiUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const response = await fetch(apiUrl, {
      ...options,
      headers,
      credentials: 'include', // Include cross-subdomain session cookies
    });

    console.log('📊 Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Backend request successful:', data);
    return data;
  } catch (error) {
    console.error('🚨 Backend request error:', error);
    throw error;
  }
}

export async function createApiKey(
  data: CreateApiKeyRequest
): Promise<ApiKeyWithKey> {
  return makeAuthenticatedRequest<ApiKeyWithKey>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listApiKeys(): Promise<ApiKeysListResponse> {
  return makeAuthenticatedRequest<ApiKeysListResponse>('/api-keys/list');
}

export async function deleteApiKey(id: string): Promise<DeleteApiKeyResponse> {
  return makeAuthenticatedRequest<DeleteApiKeyResponse>(`/api-keys/${id}`, {
    method: 'DELETE',
  });
}
