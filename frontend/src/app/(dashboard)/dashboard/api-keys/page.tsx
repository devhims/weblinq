import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ApiKeyManagerWithSuspense } from '@/components/dashboard';

export default async function ApiKeysPage() {
  // Server-side auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="text-lg lg:text-2xl font-medium mb-2">API Keys</h1>
        <p className="text-muted-foreground">Create and manage your API keys for accessing the web scraping service.</p>
      </div>

      <Suspense fallback={<div className="text-center py-8 text-muted-foreground">Loading API keys...</div>}>
        <ApiKeyManagerWithSuspense />
      </Suspense>
    </section>
  );
}
