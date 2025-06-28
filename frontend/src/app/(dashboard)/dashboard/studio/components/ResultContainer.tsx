'use client';

import { Globe } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';

interface ResultContainerProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  emptyIcon?: React.ReactNode;
  children?: React.ReactNode;
  copyContent?: any;
  darkBackground?: boolean;
  className?: string;
  height?: string;
}

export function ResultContainer({
  loading = false,
  error = null,
  empty = false,
  emptyMessage = 'Enter a URL and select an endpoint to see results',
  emptyIcon = <Globe className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-muted-foreground mb-3" />,
  children,
  copyContent,
  darkBackground = false,
  className = 'bg-card rounded-md border overflow-auto w-full relative',
  height = 'max-h-[60vh] sm:max-h-[70vh] lg:h-[800px]',
}: ResultContainerProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px]`}>
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 sm:p-5 rounded-md border border-destructive/20 overflow-hidden break-words">
        <p className="text-destructive text-sm sm:text-base font-medium">{error}</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={`flex flex-col items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px] text-center px-4`}>
        {emptyIcon}
        <p className="text-muted-foreground text-sm sm:text-base lg:text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`${className} h-full`}>
      {copyContent && <CopyButton content={copyContent} darkBackground={darkBackground} />}
      {children}
    </div>
  );
}
