'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
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
        <div className="bg-muted/60 p-2 text-base text-center border-b flex-shrink-0">
          {isMobile ? 'Mobile preview' : `This is a ${fullPage ? 'full page' : 'viewport'} screenshot.`}
        </div>

        {/* Image container - takes remaining space */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt="Screenshot preview"
              width={1200}
              height={800}
              className="rounded-md shadow max-w-full max-h-full object-contain"
              style={{ width: 'auto', height: 'auto' }}
              priority
            />
          )}
        </div>

        {/* Download button bottom right */}
        {imageUrl && (
          <a href={imageUrl} download className="absolute bottom-4 right-4">
            <Button size="sm" variant="outline" className="flex items-center gap-1">
              <FileDown className="h-4 w-4" /> Download
            </Button>
          </a>
        )}
      </div>
    </ResultContainer>
  );
}
