'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function VerificationSuccessToast() {
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified');

  useEffect(() => {
    if (verified === 'true') {
      toast.success('Email verified successfully! Welcome to your dashboard.', {
        duration: 5000,
      });
    }
  }, [verified]);

  return null; // This component only shows toasts, no visual element
}
