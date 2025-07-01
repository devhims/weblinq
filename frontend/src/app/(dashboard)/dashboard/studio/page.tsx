import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Monitor } from 'lucide-react';
import { ApiReference } from './components/ApiReference';
import StudioClientContainer from './components/StudioClientContainer';

export default async function StudioPage() {
  // Server-side auth check
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/sign-in');
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Monitor className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-lg lg:text-2xl font-medium">Studio</h1>
        </div>
        <p className="text-muted-foreground">
          Experiment with web scraping and data extraction in an interactive interface.
        </p>
      </div>

      {/* All client-side interaction is encapsulated in this component */}
      <div className="mb-6">
        <Suspense fallback={<div className="w-full text-center py-8">Loading...</div>}>
          <StudioClientContainer />
        </Suspense>
      </div>

      {/* API Reference Component */}
      <ApiReference />
    </section>
  );
}
