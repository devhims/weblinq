'use server';

import { redirect } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import {
  getUserCredits,
  deductCredits,
  getUserById,
  getPolarSubscription,
  getCreditUsageHistory,
} from '@/db/queries';

// Server-side function to get current user from session
async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    return session?.user || null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

export async function checkoutAction(formData: FormData) {
  const plan = formData.get('plan') as string;

  console.log('plan', plan);
  console.log('POLAR_PRO_PRODUCT_ID', process.env.POLAR_PRO_PRODUCT_ID);

  if (!plan) {
    throw new Error('Plan is required');
  }

  try {
    // Get the current session using headers
    const user = await getCurrentUser();

    if (!user) {
      redirect('/auth/signin?callbackUrl=/pricing');
      return;
    }

    // For Polar checkout with Better Auth, we redirect to the checkout endpoint
    // The checkout configuration is already set up in auth.ts with slug 'pro'
    const baseUrl =
      process.env.NEXTAUTH_URL ||
      process.env.BASE_URL ||
      'http://localhost:3000';
    const checkoutUrl = `${baseUrl}/api/auth/checkout/pro`;

    console.log('Redirecting to checkout URL:', checkoutUrl);

    // Redirect to the checkout endpoint
    redirect(checkoutUrl);
  } catch (error) {
    console.error('Checkout error:', error);
    redirect('/pricing?error=checkout_failed');
  }
}

export async function createCustomerPortalSession() {
  try {
    // Get current user to ensure they're authenticated
    const user = await getCurrentUser();
    if (!user) {
      redirect('/auth/signin?callbackUrl=/dashboard');
      return;
    }

    // Since Polar customer portal isn't properly configured in Better Auth,
    // redirect to a basic management page or show a message
    console.log('Customer portal requested for user:', user.id);

    // For now, redirect back to dashboard with a message
    // This should be replaced with proper Polar integration when configured
    redirect('/dashboard?message=portal_not_configured');
  } catch (error) {
    console.error('Customer portal error:', error);
    redirect('/dashboard?error=portal_failed');
  }
}

export async function cancelSubscription() {
  try {
    // Since Polar customer portal isn't properly configured,
    // this should redirect to the portal or handle cancellation differently
    console.log('Subscription cancellation requested');

    // For now, redirect to dashboard with guidance
    redirect('/dashboard?message=cancellation_not_available');
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    throw error;
  }
}

export async function getSubscriptionStatus() {
  try {
    // Get current user
    const user = await getCurrentUser();
    if (!user) {
      return {
        polar: null,
        hasActiveSubscription: false,
        provider: 'polar' as const,
        user: null,
        credits: null,
      };
    }

    // Get user credits and polar subscription
    const [credits, polarSubscription] = await Promise.all([
      getUserCredits(user.id),
      getPolarSubscription(user.id),
    ]);

    const result = {
      polar: null as any,
      hasActiveSubscription: !!polarSubscription,
      provider: 'polar' as const,
      user,
      credits,
    };

    // Since Polar customer state isn't available through Better Auth,
    // we'll rely on our database records instead
    console.log('Getting subscription status from database records only');

    return result;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    return {
      polar: null,
      hasActiveSubscription: false,
      provider: 'polar' as const,
      user: null,
      credits: null,
    };
  }
}

export async function ingestUsageEvent(
  event: string,
  metadata: Record<string, any>
) {
  try {
    // Since Polar usage ingestion isn't configured through Better Auth,
    // we'll log the event for now
    console.log('Usage event ingestion requested:', { event, metadata });

    // This should be replaced with proper Polar API calls when configured
    // For now, we can store this locally or skip it

    return { success: true, message: 'Usage event logged locally' };
  } catch (error) {
    console.error('Usage ingestion error:', error);
    // Don't throw error as this shouldn't break the main flow
  }
}

// Credit Management Actions
export async function checkAndDeductCredits(
  operation: string,
  creditsRequired: number,
  metadata?: any
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Check available credits
    const userCredits = await getUserCredits(user.id);
    if (!userCredits) {
      throw new Error('Could not retrieve user credits');
    }

    if (userCredits.availableCredits < creditsRequired) {
      throw new Error(
        `Insufficient credits. Required: ${creditsRequired}, Available: ${userCredits.availableCredits}`
      );
    }

    // Deduct credits
    await deductCredits(user.id, creditsRequired, operation, metadata);

    return {
      success: true,
      creditsDeducted: creditsRequired,
      remainingCredits: userCredits.availableCredits - creditsRequired,
    };
  } catch (error) {
    console.error('Error checking/deducting credits:', error);
    throw error;
  }
}

export async function getUserCreditInfo() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    const credits = await getUserCredits(user.id);
    const usageHistory = await getCreditUsageHistory(user.id, 10);

    return {
      credits,
      usageHistory,
    };
  } catch (error) {
    console.error('Error getting user credit info:', error);
    return null;
  }
}
