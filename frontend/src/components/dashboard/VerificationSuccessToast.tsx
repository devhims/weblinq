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

  // Debug: Log component mounting
  console.log('🔍 CreditAssignmentToast component mounted/rendered');

  useEffect(() => {
    console.log('🔍 CreditAssignmentToast useEffect running', {
      newUser,
      searchParamsString: searchParams.toString(),
      allParams: Object.fromEntries(searchParams.entries()),
    });

    // Show credit notification for new users (both email signup and OAuth)
    if (newUser === 'true') {
      console.log('🎯 Conditions met - attempting to show toast');

      // Test if toast function is available
      console.log('🔍 Toast function:', typeof toast, toast);

      toast.success(
        "🎉 Welcome! You've been credited with 1,000 free credits to get started.",
        {
          duration: 6000,
          description: 'Keep track of your credits in the billing page.',
        },
      );

      console.log('🎉 Toast.success called');
    } else {
      console.log(
        '❌ CreditAssignmentToast: Not showing notification (newUser !== "true")',
        { newUser, type: typeof newUser },
      );
    }
  }, [newUser, searchParams]);

  return null; // This component only shows toasts, no visual element
}
