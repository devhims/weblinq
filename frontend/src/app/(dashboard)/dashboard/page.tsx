import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  // Server-side redirect to studio as the default dashboard page
  redirect('/dashboard/studio');
}
