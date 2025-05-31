import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { config } from '@/config/env';
import DashboardClient from './dashboard-client';

// Server component that checks session
export default async function DashboardPage() {
  // Get session from backend directly
  const session = await getServerSession();

  // Redirect to login if no session
  if (!session?.user) {
    redirect('/login');
  }

  // Render client component with session data
  return <DashboardClient initialSession={session} />;
}

async function getServerSession() {
  try {
    const headersList = await headers();

    // Get cookies from the request
    const cookieHeader = headersList.get('cookie') || '';

    // Call backend directly with cookies
    const response = await fetch(`${config.backendUrl}/api/auth/get-session`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Don't cache session data
    });

    if (!response.ok) {
      console.error('Failed to get session from backend:', response.status);
      return null;
    }

    const sessionData = await response.json();
    return sessionData;
  } catch (error) {
    console.error('Error getting session from backend:', error);
    return null;
  }
}
