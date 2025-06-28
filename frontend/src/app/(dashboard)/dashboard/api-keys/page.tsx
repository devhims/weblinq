import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
      <h1 className="text-lg lg:text-2xl font-medium mb-6">API Keys</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Manage API Keys</CardTitle>
          <CardDescription>Create and manage your API keys for accessing the web scraping service.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div>Loading API keys...</div>}>
            <ApiKeyManagerWithSuspense />
          </Suspense>
        </CardContent>
      </Card>
    </section>
  );
}
