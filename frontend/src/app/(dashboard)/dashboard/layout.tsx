import { ServerAuthGuard } from '@/components/auth/ServerAuthGuard';
import { DashboardLayoutClient } from '@/components/dashboard/DashboardLayoutClient';
import { config } from '@/config/env';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ServerAuthGuard redirectTo={`${config.frontendUrl}/sign-in`}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </ServerAuthGuard>
  );
}
