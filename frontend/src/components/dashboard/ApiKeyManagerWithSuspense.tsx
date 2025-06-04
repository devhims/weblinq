import { listApiKeys, type ApiKeysListResponse } from '@/lib/api-keys';
import { ApiKeyManagerClient } from './ApiKeyManagerClient';

// Server component that fetches initial API keys data for the ApiKeyManagerClient
export async function ApiKeyManagerWithSuspense({
  className,
}: {
  className?: string;
}) {
  console.log('🏗️ [Server Component] ApiKeyManagerWithSuspense starting...');

  let initialApiKeys: ApiKeysListResponse;
  try {
    console.log('🏗️ [Server Component] About to call listApiKeys()...');
    // Fetch initial data using the API function (no caching)
    initialApiKeys = await listApiKeys();
    console.log(
      `🏗️ [Server Component] Successfully fetched ${initialApiKeys.apiKeys.length} initial API keys:`,
      initialApiKeys
    );
  } catch (error) {
    console.warn(
      '⚠️ [Server Component] Failed to fetch initial API keys, falling back to empty list:',
      error
    );
    initialApiKeys = {
      apiKeys: [],
      total: 0,
    };
  }

  console.log(
    '🏗️ [Server Component] Rendering ApiKeyManagerClient with data:',
    initialApiKeys
  );

  return (
    <ApiKeyManagerClient
      initialApiKeys={initialApiKeys}
      className={className}
    />
  );
}
