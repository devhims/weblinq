'use client';

// A single utility that shows toast notifications based on query parameters but
// ensures they are displayed **only once** per browser by persisting a flag in
// `localStorage` and then cleaning the parameter from the URL so it will not
// retrigger on client-side navigations.

import { useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

/**
 * Shows a toast when `verified=true` is present in the query string. After the
 * message is displayed we remove the parameter from the URL and remember in
 * `localStorage` so it cannot be displayed again on subsequent renders.
 */
export function VerificationSuccessToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const verified = searchParams.get('verified');
    if (verified !== 'true') return;

    const STORAGE_KEY = 'weblinq_verified_toast_shown';
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      toast.success('Email verified successfully! Welcome to your dashboard.', {
        duration: 5000,
      });
      localStorage.setItem(STORAGE_KEY, 'true');
    }

    // Strip the param so the toast will not be triggered again on route changes
    const params = new URLSearchParams(searchParams.toString());
    params.delete('verified');
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  return null; // Render nothing – this component is only for side-effects.
}

/**
 * Shows a one-time welcome/credit toast when `new_user=true` is present in the
 * query string. Behaviour is identical to the verification toast above.
 */
export function CreditAssignmentToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const newUser = searchParams.get('new_user');
    if (newUser !== 'true') return;

    toast.success(
      "🎉 Welcome! You've been credited with 1,000 free credits to get started.",
      {
        duration: 6000,
      },
    );

    // Remove the param from the URL immediately so the toast won't repeat.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('new_user');
    params.delete('verified'); // Optional – also strip verified if present.
    const search = params.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  return null;
}
