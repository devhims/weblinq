import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { ApiKeyManagerWithSuspense } from '@/components/dashboard/ApiKeyManagerWithSuspense';
import { ApiKeyManagerLoading } from '@/components/dashboard/ApiKeyManagerLoading';
import { SignOutButton } from '@/components/dashboard/SignOutButton';
import { VerificationSuccessToast } from '@/components/dashboard/VerificationSuccessToast';

export default async function DashboardPage() {
  // Check session on the server side
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect to home if no session
  if (!session?.user) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={null}>
        <VerificationSuccessToast />
      </Suspense>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back, {session.user.name || session.user.email}!</p>
          </div>
          <SignOutButton />
        </div>

        <div className="grid gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">Account Information</h2>
            <div className="space-y-3">
              <p className="text-sm">
                <span className="font-medium text-gray-700">Email:</span>
                <span className="text-gray-600 ml-2">{session.user.email}</span>
              </p>
              {session.user.name && (
                <p className="text-sm">
                  <span className="font-medium text-gray-700">Name:</span>
                  <span className="text-gray-600 ml-2">{session.user.name}</span>
                </p>
              )}
              <p className="text-sm">
                <span className="font-medium text-gray-700">User ID:</span>
                <span className="text-gray-600 ml-2 font-mono text-xs">{session.user.id}</span>
              </p>
            </div>
          </div>

          {/* API Keys Section */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">API Keys</h2>
              <p className="text-gray-600">Manage your API keys to access our services programmatically</p>
            </div>

            <Suspense fallback={<ApiKeyManagerLoading />}>
              <ApiKeyManagerWithSuspense />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
