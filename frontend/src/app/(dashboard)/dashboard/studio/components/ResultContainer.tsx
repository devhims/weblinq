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
  emptyIcon = <Globe className="h-12 w-12 text-muted-foreground mb-3" />,
  children,
  copyContent,
  darkBackground = false,
  className = 'bg-card rounded-md border overflow-auto w-full relative',
  height = 'h-[800px]',
}: ResultContainerProps) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center ${height}`}>
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-5 rounded-md border border-destructive/20 overflow-hidden break-words">
        <p className="text-destructive text-base font-medium">{error}</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className={`flex flex-col items-center justify-center ${height} text-center`}>
        {emptyIcon}
        <p className="text-muted-foreground text-lg">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`${className} ${height}`}>
      {copyContent && <CopyButton content={copyContent} darkBackground={darkBackground} />}
      {children}
    </div>
  );
}
