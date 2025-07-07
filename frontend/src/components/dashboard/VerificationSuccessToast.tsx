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

export function CreditAssignmentToast() {
  const searchParams = useSearchParams();
  const newUser = searchParams.get('new_user');

  useEffect(() => {
    // Show credit notification for new users (both email signup and OAuth)
    if (newUser === 'true') {
      toast.success(
        "🎉 Welcome! You've been credited with 1,000 free credits to get started.",
        {
          duration: 6000,
          description:
            'Each web scrape or search operation uses 1 credit. Upgrade to Pro for 5,000 monthly credits.',
        },
      );
    } else {
      console.log(
        '❌ CreditAssignmentToast: Not showing notification (newUser !== "true")',
      );
    }
  }, [newUser, searchParams]);

  return null; // This component only shows toasts, no visual element
}
