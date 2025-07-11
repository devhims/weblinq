import { ServerAuthGuard } from '@/components/auth/ServerAuthGuard';
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ServerAuthGuard>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </ServerAuthGuard>
  );
}
