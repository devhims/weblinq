import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiKeyManager } from '@/components/dashboard/ApiKeyManager';
import { TaskManager } from '@/components/dashboard/TaskManager';
import { SignOutButton } from '@/components/dashboard/SignOutButton';

export default async function DashboardPage() {
  // Check session on the server side
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Redirect to home if no session
  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='container mx-auto px-4 py-8 max-w-7xl'>
        <div className='flex justify-between items-center mb-8'>
          <div>
            <h1 className='text-3xl font-bold text-gray-900'>Dashboard</h1>
            <p className='text-gray-600 mt-2'>
              Welcome back, {session.user.name || session.user.email}!
            </p>
          </div>
          <SignOutButton />
        </div>

        <div className='grid gap-6'>
          <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
            <h2 className='text-xl font-semibold mb-4 text-gray-900'>
              Account Information
            </h2>
            <div className='space-y-3'>
              <p className='text-sm'>
                <span className='font-medium text-gray-700'>Email:</span>
                <span className='text-gray-600 ml-2'>{session.user.email}</span>
              </p>
              {session.user.name && (
                <p className='text-sm'>
                  <span className='font-medium text-gray-700'>Name:</span>
                  <span className='text-gray-600 ml-2'>
                    {session.user.name}
                  </span>
                </p>
              )}
              <p className='text-sm'>
                <span className='font-medium text-gray-700'>User ID:</span>
                <span className='text-gray-600 ml-2 font-mono text-xs'>
                  {session.user.id}
                </span>
              </p>
            </div>
          </div>

          <TaskManager />

          <ApiKeyManager />
        </div>
      </div>
    </div>
  );
}
