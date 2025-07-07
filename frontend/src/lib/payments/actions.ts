'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserCredits, deductCredits, getCreditUsageHistory } from '@/db/queries';

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

  // rely on your DB mirror
  const { balance } = await getUserCredits(user.id);
  // 🔎 optional: add a DB query for subscriptions here
  return { hasActiveSubscription: false, plan: 'free', balance };
}

/* -------------------------------------------------- */
/* 4. Credits helpers (unchanged except schema fields)*/
/* -------------------------------------------------- */
export async function checkAndDeductCredits(operation: string, creditsRequired: number, metadata?: any) {
  const user = await getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const { balance } = await getUserCredits(user.id);
  if (balance < creditsRequired) throw new Error(`Need ${creditsRequired}, have ${balance}`);

  await deductCredits(user.id, creditsRequired, operation, metadata);
  return { success: true, remaining: balance - creditsRequired };
}

export async function getUserCreditInfo() {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const { balance, plan, lastRefill } = await getUserCredits(user.id);
    return { credits: { balance, plan, lastRefill } };
  } catch (error) {
    // Handle case where user doesn't have credits yet (existing users before new system)
    console.warn(`User ${user.id} doesn't have credits yet. This may be an existing user from before the new system.`);

    // For existing users, we can bootstrap them here as a fallback
    // This is temporary until all existing users have been migrated
    try {
      const { assignInitialCredits } = await import('@/db/queries');
      await assignInitialCredits(user.id);

      // Retry getting credits after assignment
      const [credits, history] = await Promise.all([getUserCredits(user.id), getCreditUsageHistory(user.id, 10)]);
      return { credits, history };
    } catch (bootstrapError) {
      console.error(`Failed to bootstrap credits for user ${user.id}:`, bootstrapError);

      // Return default values if all else fails
      return {
        credits: { balance: 0, plan: 'free' as const, lastRefill: null },
        history: [],
      };
    }
  }
}
