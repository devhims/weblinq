import { ActivityLoading } from '@/components/dashboard';

export default function ActivityPageSkeleton() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">Activity Log</h1>
      <ActivityLoading />
    </section>
  );
}
