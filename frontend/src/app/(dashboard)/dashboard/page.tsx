import { redirect } from 'next/navigation';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ new_user?: string }>;
}) {
  // Await searchParams as required in Next.js 15
  const params = await searchParams;

  // Preserve the new_user parameter when redirecting to studio
  const newUserParam = params.new_user === 'true' ? '?new_user=true' : '';

  // Server-side redirect to studio as the default dashboard page
  redirect(`/dashboard/studio${newUserParam}`);
}
