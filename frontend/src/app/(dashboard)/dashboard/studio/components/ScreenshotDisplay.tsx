'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { ResultContainer } from './ResultContainer';

interface ScreenshotDisplayProps {
  imageUrl?: string;
  loading?: boolean;
  error?: string | null;
  isMobile?: boolean;
  fullPage?: boolean;
  priority?: boolean;
}

export function ScreenshotDisplay({
  imageUrl,
  loading = false,
  error = null,
  isMobile = false,
  fullPage = false,
  priority = false,
}: ScreenshotDisplayProps) {
  // local UI state
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // ref gives us direct access to the underlying <img>
  const imgRef = useRef<HTMLImageElement | null>(null);

  /* ------------------------------------------------------------------ */
  /* Effect: run every time imageUrl changes                            */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!imageUrl) {
      // no image => reset everything
      setImageLoading(false);
      setImageError(null);
      return;
    }

    // start fresh loading cycle
    setImageLoading(true);
    setImageError(null);

    // If the image is already in the browser cache, .complete === true.
    // Clear loading immediately so the spinner disappears.
    if (imgRef.current?.complete) {
      setImageLoading(false);
    }
  }, [imageUrl]);

  /* ------------------------------------------------------------------ */
  /* Handlers passed to <Image />                                       */
  /* ------------------------------------------------------------------ */
  const handleImageLoad = () => setImageLoading(false);

  const handleImageError = () => {
    setImageError('Failed to load screenshot');
    setImageLoading(false);
  };

  /* ------------------------------------------------------------------ */
  /* What we pass to ResultContainer                                    */
  /* ------------------------------------------------------------------ */
  const isLoading = loading || imageLoading;
  const displayError = error || imageError;

  /* ------------------------------------------------------------------ */
  /* Early-return empty state                                           */
  /* ------------------------------------------------------------------ */
  if (!imageUrl && !loading && !error) {
    return (
      <ResultContainer
        empty
        emptyMessage="No image available"
        className="border rounded-md w-full relative overflow-hidden"
      />
    );
  }

  /* ------------------------------------------------------------------ */
  /* Main render                                                        */
  /* ------------------------------------------------------------------ */
  return (
    <ResultContainer
      loading={isLoading}
      error={displayError}
      className="border rounded-md w-full relative overflow-hidden"
    >
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="bg-muted/60 p-1.5 sm:p-2 text-xs sm:text-sm lg:text-base text-center border-b flex-shrink-0">
          {isMobile ? 'Mobile preview' : `This is a ${fullPage ? 'full page' : 'viewport'} screenshot.`}
        </div>

        {/* Image area */}
        <div className="flex-1 flex items-center justify-center p-2 sm:p-3 lg:p-4 min-h-0 relative">
          {imageUrl && (
            <Image
              ref={imgRef} /* ← critical for cache detection */
              src={imageUrl}
              alt="Screenshot preview"
              fill /* stretch inside flex container */
              sizes="(max-width: 640px) 100vw,
                     (max-width: 1024px) 90vw,
                     80vw"
              className="rounded-md shadow object-contain"
              quality={85}
              priority={priority}
              placeholder="empty"
              onLoad={handleImageLoad}
              onLoadingComplete={handleImageLoad} /* fires for cached images */
              onError={handleImageError}
            />
          )}
        </div>
      </div>
    </ResultContainer>
  );
}
