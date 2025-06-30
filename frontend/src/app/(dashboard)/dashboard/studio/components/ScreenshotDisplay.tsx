'use client';

import Image from 'next/image';
import { useState } from 'react';

import { ResultContainer } from './ResultContainer';

interface ScreenshotDisplayProps {
  imageUrl?: string;
  loading?: boolean;
  error?: string | null;
  isMobile?: boolean;
  fullPage?: boolean;
  priority?: boolean; // Allow control over priority from parent
}

export function ScreenshotDisplay({
  imageUrl,
  loading = false,
  error = null,
  isMobile = false,
  fullPage = false,
  priority = false, // Default to false, let parent decide
}: ScreenshotDisplayProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(true);

  if (!imageUrl && !loading && !error) {
    return (
      <ResultContainer
        empty={true}
        emptyMessage="No image available"
        className="border rounded-md w-full relative overflow-hidden"
      />
    );
  }

  const handleImageError = () => {
    setImageError('Failed to load screenshot');
    setImageLoading(false);
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(null);
  };

  return (
    <ResultContainer
      loading={loading || imageLoading}
      error={error || imageError}
      className="border rounded-md w-full relative overflow-hidden"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="bg-muted/60 p-1.5 sm:p-2 text-xs sm:text-sm lg:text-base text-center border-b flex-shrink-0">
          {isMobile ? 'Mobile preview' : `This is a ${fullPage ? 'full page' : 'viewport'} screenshot.`}
        </div>

        {/* Image container - takes remaining space */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-3 lg:p-4 min-h-0 relative">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Screenshot preview"
              fill
              className="rounded-md shadow object-contain"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
              quality={85}
              priority={priority}
              onError={handleImageError}
              onLoad={handleImageLoad}
              placeholder="empty"
            />
          )}
        </div>
      </div>
    </ResultContainer>
  );
}
