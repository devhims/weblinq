import { listApiKeys } from '@/lib/api-keys';
import { ApiKeyManagerPromiseClient } from './ApiKeyManagerPromiseClient';

// Server component that creates a promise for streaming (proper Next.js 15 pattern)
export function ApiKeyManagerWithSuspense({
  className,
}: {
  className?: string;
}) {
  console.log(
    '🏗️ [Server Component - Suspense Streaming] Creating API keys promise...'
  );

  // DON'T await - create promise for streaming
  const apiKeysPromise = listApiKeys();

  console.log(
    '🏗️ [Server Component - Suspense Streaming] Passing promise to client for streaming'
  );

  return (
    <ApiKeyManagerPromiseClient
      apiKeysPromise={apiKeysPromise}
      className={className}
    />
  );
}
