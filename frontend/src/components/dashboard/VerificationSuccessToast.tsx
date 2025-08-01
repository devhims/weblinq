'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function VerificationSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const verified = searchParams.get('verified');
  const hasShownRef = useRef(false);

  useEffect(() => {
    if (verified === 'true' && !hasShownRef.current) {
      hasShownRef.current = true;
      toast.success('Email verified successfully! Welcome to your dashboard.', {
        duration: 5000,
      });

      // Clean up URL parameter after showing toast
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('verified');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [verified, router]);

  return null;
}

export function CreditAssignmentToast() {
  const searchParams = useSearchParams();
  const newUser = searchParams.get('new_user');

  useEffect(() => {
    // Show credit notification for new users (both email signup and OAuth)
    if (newUser === 'true') {
      // Check if we've already shown this toast in this browser session
      const hasShownThisSession = sessionStorage.getItem('credit_toast_shown');

      if (!hasShownThisSession) {
        sessionStorage.setItem('credit_toast_shown', 'true');

        toast.success(
          "🎉 Welcome! You've been credited with 1,000 free credits to get started.",
          {
            duration: 6000,
            description: 'Keep track of your credits in the billing page.',
          },
        );
      }
    }
  }, [newUser]);

  return null;
}
