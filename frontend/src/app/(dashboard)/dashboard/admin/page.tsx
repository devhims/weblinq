import { Suspense } from 'react';
import { AdminPageClient } from './AdminPageClient';

export const metadata = {
  title: 'Admin Panel - WebLinQ',
  description: 'Admin panel for managing users and system settings',
};

export default function AdminPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <p className="text-muted-foreground">
          Manage users, permissions, and system settings
        </p>
      </div>

      <Suspense fallback={<div>Loading admin panel...</div>}>
        <AdminPageClient />
      </Suspense>
    </div>
  );
}
