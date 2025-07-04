import { listFilesServer } from '@/lib/studio-api';
import { ActivityClient } from './ActivityClient';

// Server component that creates a promise for streaming (proper Next.js 15 pattern)
export function ActivityWithSuspense({ className }: { className?: string }) {
  console.log('🏗️ [Server Component - Suspense Streaming] Creating files promise...');

  // In Vercel preview deployments we cannot authenticate server-side, so we
  // skip the initial server request (which would 401) and let the client
  // fetch the data with the API key stored in localStorage. Otherwise we do
  // the usual server fetch so that data can be streamed.

  const isPreview = process.env.VERCEL_ENV === 'preview';

  // DON'T await - create promise for streaming when not in preview. In preview
  // we provide a resolved promise with empty data to satisfy the type without
  // triggering a failing request.
  const filesPromise = isPreview
    ? Promise.resolve({
        success: true,
        data: {
          sqliteStatus: { enabled: false, available: false, userId: '' },
          files: [],
          totalFiles: 0,
          hasMore: false,
        },
      })
    : listFilesServer({
        limit: 50,
        offset: 0,
        sort_by: 'created_at',
        order: 'desc',
      });

  console.log('🏗️ [Server Component - Suspense Streaming] Passing files promise to client for streaming');

  return <ActivityClient filesPromise={filesPromise} className={className} />;
}
