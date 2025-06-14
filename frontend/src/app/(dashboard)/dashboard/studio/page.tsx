'use client';

import PlaygroundContainer from './components/PlaygroundContainer';
import { InfoIcon } from 'lucide-react';
import { ReactNode, Suspense } from 'react';

// Custom Alert components since the import is failing
interface AlertProps {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'destructive';
  [x: string]: any;
}

function Alert({
  children,
  className = '',
  variant = 'default',
  ...props
}: AlertProps) {
  return (
    <div
      className={`relative rounded-lg border border-border p-4 ${className}`}
      role='alert'
      {...props}
    >
      {children}
    </div>
  );
}

interface AlertTitleProps {
  children: ReactNode;
  className?: string;
  [x: string]: any;
}

function AlertTitle({ children, className = '', ...props }: AlertTitleProps) {
  return (
    <div
      className={`font-medium text-lg tracking-tight ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

interface AlertDescriptionProps {
  children: ReactNode;
  className?: string;
  [x: string]: any;
}

function AlertDescription({
  children,
  className = '',
  ...props
}: AlertDescriptionProps) {
  return (
    <div
      className={`text-base text-muted-foreground mt-1.5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default function PlaygroundPage() {
  return (
    <div className='w-full'>
      <Suspense fallback={<div>Loading...</div>}>
        <PlaygroundContainer />
      </Suspense>
    </div>
  );
}
