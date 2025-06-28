import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function ApiKeysSkeleton() {
  return (
    <div className="space-y-6">
      {/* Create Button Skeleton */}
      <div className="flex justify-end items-center">
        <Skeleton className="h-10 w-48" />
      </div>

      {/* Desktop Table Layout (lg and up) */}
      <div className="hidden lg:block border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_2.5fr_1.2fr_1.2fr_1.5fr_0.8fr] gap-6 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Table Body */}
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[2fr_2.5fr_1.2fr_1.2fr_1.5fr_0.8fr] gap-6 p-4">
              {/* Name */}
              <div className="flex items-center">
                <Skeleton className={`h-4 ${i === 1 ? 'w-32' : i === 2 ? 'w-28' : 'w-36'}`} />
              </div>

              {/* Secret Key */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-48" />
              </div>

              {/* Created */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-20" />
              </div>

              {/* Last Used */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-20" />
              </div>

              {/* Project Access */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-24" />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center">
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tablet Layout (md to lg) */}
      <div className="hidden md:block lg:hidden border rounded-lg overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[2.5fr_3fr_1.5fr_1fr] gap-4 p-4 border-b bg-muted/50">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Table Body */}
        <div className="divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[2.5fr_3fr_1.5fr_1fr] gap-4 p-4">
              {/* Name */}
              <div className="flex items-center">
                <Skeleton className={`h-4 ${i === 1 ? 'w-32' : i === 2 ? 'w-28' : 'w-36'}`} />
              </div>

              {/* Secret Key */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-48" />
              </div>

              {/* Created */}
              <div className="flex items-center">
                <Skeleton className="h-4 w-20" />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center">
                <Skeleton className="h-9 w-9 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card Layout (sm and below) */}
      <div className="block md:hidden space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="px-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className={`h-5 ${i === 1 ? 'w-32' : i === 2 ? 'w-28' : 'w-36'}`} />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-9 w-9 rounded ml-2" />
              </div>

              <div className="space-y-3">
                <div>
                  <Skeleton className="h-3 w-20 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <Skeleton className="h-3 w-16 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div>
                    <Skeleton className="h-3 w-20 mb-1" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
