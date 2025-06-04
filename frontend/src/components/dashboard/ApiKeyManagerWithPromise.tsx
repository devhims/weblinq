import { listApiKeys } from '@/lib/api-keys';
import { ApiKeyManagerPromiseClient } from './ApiKeyManagerPromiseClient';

// Server component that passes a promise directly to the client component (Next.js 15 pattern)
export async function ApiKeyManagerWithPromise({
  className,
}: {
  className?: string;
}) {
  console.log(
    '🏗️ [Server Component - Promise Pattern] Creating API keys promise...'
  );

  // Don't await the promise - pass it directly to the client component
  const apiKeysPromise = listApiKeys();

  console.log(
    '🏗️ [Server Component - Promise Pattern] Passing promise to client component'
  );

  return (
    <ApiKeyManagerPromiseClient
      apiKeysPromise={apiKeysPromise}
      className={className}
    />
  );
}
