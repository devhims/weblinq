'use client';

import Image from 'next/image';

import { ResultContainer } from './ResultContainer';

interface ScreenshotDisplayProps {
  imageUrl?: string;
  loading?: boolean;
  error?: string | null;
  isMobile?: boolean;
  fullPage?: boolean;
}

export function ScreenshotDisplay({
  imageUrl,
  loading = false,
  error = null,
  isMobile = false,
  fullPage = false,
}: ScreenshotDisplayProps) {
  if (!imageUrl && !loading && !error) {
    return (
      <ResultContainer
        empty={true}
        emptyMessage="No image available"
        className="border rounded-md w-full relative overflow-hidden"
      />
    );
  }

  return (
    <ResultContainer loading={loading} error={error} className="border rounded-md w-full relative overflow-hidden">
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="bg-muted/60 p-1.5 sm:p-2 text-xs sm:text-sm lg:text-base text-center border-b flex-shrink-0">
          {isMobile ? 'Mobile preview' : `This is a ${fullPage ? 'full page' : 'viewport'} screenshot.`}
        </div>

        {/* Image container - takes remaining space */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-3 lg:p-4 min-h-0">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Screenshot preview"
              width={1200}
              height={800}
              className="rounded-md shadow max-w-full max-h-full object-contain"
              style={{ width: 'auto', height: 'auto' }}
              unoptimized
              priority
            />
          )}
        </div>
      </div>
    </ResultContainer>
  );
}
