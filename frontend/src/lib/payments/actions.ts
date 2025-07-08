'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { userApi } from '@/lib/studio-api';

/* -------------------------------------------------- */
/* helper to fetch current user                       */
/* -------------------------------------------------- */
async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

/* -------------------------------------------------- */
/* 1. CHECKOUT (upgrade)                              */
/* -------------------------------------------------- */
// export async function checkoutAction(formData: FormData) {
//   const plan = formData.get('plan');
//   if (plan !== 'pro') throw new Error('Only the “pro” plan is supported.');

//   const user = await getCurrentUser();
//   if (!user) {
//     redirect('/auth/signin?callbackUrl=/pricing');
//     return;
//   }

//   /* built-in checkout route created by the plugin */
//   redirect('/api/auth/checkout/pro');
// }

/* -------------------------------------------------- */
/* 2. CUSTOMER  PORTAL                                */
/* -------------------------------------------------- */
export async function createCustomerPortalSession() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/auth/signin?callbackUrl=/dashboard');
    return;
  }

  /* built-in portal route created by the plugin */
  redirect('/api/auth/customer/portal');
}

/* same helper for “cancel” button —> portal screen */
export const cancelSubscription = createCustomerPortalSession;

/* -------------------------------------------------- */
/* 3. Subscription status & credits (unchanged)       */
/* -------------------------------------------------- */
export async function getSubscriptionStatus() {
  const user = await getCurrentUser();
  if (!user) return { hasActiveSubscription: false, plan: 'free', balance: 0 };

  try {
    // Get credits via API
    const creditInfo = await getUserCreditInfo();
    const balance = creditInfo?.credits?.balance || 0;
    const plan = creditInfo?.credits?.plan || 'free';
    const hasActiveSubscription = plan === 'pro';

    return { hasActiveSubscription, plan, balance };
  } catch (error) {
    console.error('Failed to get subscription status:', error);
    return { hasActiveSubscription: false, plan: 'free', balance: 0 };
  }
}

/* -------------------------------------------------- */
/* 4. Credits helpers (unchanged except schema fields)*/
/* -------------------------------------------------- */
export async function checkAndDeductCredits(
  operation: string,
  creditsRequired: number,
  metadata?: any,
) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  // Check current balance via API
  const creditInfo = await getUserCreditInfo();
  const balance = creditInfo?.credits?.balance || 0;

  if (balance < creditsRequired)
    throw new Error(`Need ${creditsRequired}, have ${balance}`);

  // Call backend API to deduct credits
  const response = await fetch('/api/user/deduct-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ amount: creditsRequired, operation, metadata }),
  });

  if (!response.ok) {
    throw new Error(`Failed to deduct credits: ${response.status}`);
  }

  return { success: true, remaining: balance - creditsRequired };
}

export async function getUserCreditInfo() {
  try {
    const result = await userApi.getCredits();
    if (result.success) {
      return { credits: result.data };
    } else {
      return {
        success: false,
        error: 'Failed to fetch credits',
      };
    }
  } catch (error) {
    console.error('Error fetching user credits:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credits',
    };
  }
}
