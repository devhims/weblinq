import { listApiKeys } from '@/lib/api-keys';
import { ApiKeyManagerPromiseClient } from './ApiKeyManagerPromiseClient';

// Server component that creates a promise for streaming (proper Next.js 15 pattern)
export function ApiKeyManagerWithSuspense({ className }: { className?: string }) {
  console.log('🏗️ [Server Component - Suspense Streaming] Creating API keys promise...');

  // In Vercel preview deployments we cannot authenticate server-side, so we
  // skip the initial server request (which would 401) and let the client
  // fetch the data with the API key stored in localStorage. Otherwise we do
  // the usual server fetch so that data can be streamed.

  const isPreview = process.env.VERCEL_ENV === 'preview';

  // DON'T await - create promise for streaming when not in preview. In preview
  // we provide a resolved promise with empty data to satisfy the type without
  // triggering a failing request.
  const apiKeysPromise = isPreview ? Promise.resolve({ apiKeys: [], total: 0 }) : listApiKeys();

  console.log('🏗️ [Server Component - Suspense Streaming] Passing promise to client for streaming');

  return <ApiKeyManagerPromiseClient apiKeysPromise={apiKeysPromise} className={className} />;
}
