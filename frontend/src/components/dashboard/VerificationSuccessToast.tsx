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
  const router = useRouter();
  const newUser = searchParams.get('new_user');
  const hasShownRef = useRef(false);

  useEffect(() => {
    // Only show for new users and only once ever per browser
    if (newUser === 'true' && !hasShownRef.current) {
      // Use localStorage to permanently track if user has seen welcome toast
      // This prevents showing it again even after browser restarts
      const hasSeenWelcomeToast = localStorage.getItem(
        'weblinq_welcome_toast_shown',
      );

      if (!hasSeenWelcomeToast) {
        hasShownRef.current = true;
        localStorage.setItem('weblinq_welcome_toast_shown', 'true');

        toast.success(
          "🎉 Welcome! You've been credited with 1,000 free credits to get started.",
          {
            duration: 6000,
            description: 'Keep track of your credits in the billing page.',
          },
        );
      }

      // Always clean up URL parameter after checking, regardless of whether toast was shown
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('new_user');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [newUser, router]);

  return null;
}
