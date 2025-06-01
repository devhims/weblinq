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

// ✅ BEST SOLUTION: Use Next.js API route proxy for same-domain requests
async function makeAuthenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Use the Next.js proxy API route instead of direct backend calls
  const proxyUrl = `/api/backend-proxy${endpoint}`;

  console.log('🚀 Making request via Next.js proxy:', proxyUrl);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const response = await fetch(proxyUrl, {
      ...options,
      headers,
      credentials: 'include', // Include same-domain session cookies
    });

    console.log('📊 Proxy response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Proxy request failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('✅ Proxy request successful:', data);
    return data;
  } catch (error) {
    console.error('🚨 Proxy request error:', error);
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
