'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createCustomerPortalSession,
  getSubscriptionStatus,
} from '@/lib/payments/actions';
import { useSession } from '@/lib/auth-client';
import { Suspense } from 'react';
import React from 'react';

function SubscriptionSkeleton() {
  return (
    <Card className='mb-8 h-[140px]'>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ManageSubscription() {
  const { data: session } = useSession();

  // Use useEffect and useState for subscription data since it's async
  const [subscriptionData, setSubscriptionData] = React.useState<any>(null);
  const [creditsData, setCreditsData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchData() {
      try {
        if (session?.user?.id) {
          const [subscriptionResult, creditsResult] = await Promise.all([
            getSubscriptionStatus(), // Keep this for Polar state
            fetch('/api/user/credits').then((res) => res.json()), // Use API route for credits
          ]);
          setSubscriptionData(subscriptionResult);
          setCreditsData(creditsResult);
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [session?.user]);

  // Determine current plan based on subscription status
  const hasActiveSubscription =
    subscriptionData?.hasActiveSubscription || false;
  const currentPlan = creditsData?.credits?.planName || 'free';

  const planNames: Record<string, string> = {
    free: 'Free',
    pro: 'Pro',
    enterprise: 'Enterprise',
  };
  const planDisplayName = planNames[currentPlan] || 'Free';

  const planStatus = hasActiveSubscription
    ? 'Active subscription'
    : 'Free plan';

  // Calculate available credits
  const availableCredits = creditsData?.credits?.availableCredits || 0;
  const totalCredits = creditsData?.credits?.credits || 1000;
  const creditsUsed = creditsData?.credits?.creditsUsed || 0;

  if (loading) {
    return <SubscriptionSkeleton />;
  }

  return (
    <Card className='mb-8'>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center'>
            <div className='mb-4 sm:mb-0'>
              <div className='flex items-center gap-2'>
                <p className='font-medium'>Current Plan: {planDisplayName}</p>
                {currentPlan === 'pro' && (
                  <span className='inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-2.5 py-0.5 text-xs font-medium text-white'>
                    PRO
                  </span>
                )}
              </div>
              <p className='text-sm text-muted-foreground'>{planStatus}</p>
              {currentPlan === 'free' && (
                <p className='text-sm text-blue-600 mt-1'>
                  Upgrade to Pro for 5x more credits (5,000/month) and monthly
                  credit renewal
                </p>
              )}
            </div>
            <div className='flex gap-2'>
              {currentPlan === 'free' && (
                <Button asChild variant='default'>
                  <a href='/pricing'>Upgrade to Pro</a>
                </Button>
              )}
              {hasActiveSubscription && (
                <Button
                  variant='outline'
                  onClick={async () => {
                    try {
                      await createCustomerPortalSession();
                    } catch (error) {
                      console.error('Portal error:', error);
                      // Could show a toast notification here
                    }
                  }}
                >
                  Manage Subscription
                </Button>
              )}
            </div>
          </div>

          {/* Simplified credits display */}
          <div className='grid grid-cols-2 gap-4 pt-4 border-t'>
            <div>
              <p className='text-sm font-medium text-gray-700'>
                Available Credits
              </p>
              <p className='text-lg font-semibold text-green-600'>
                {availableCredits.toLocaleString()}
              </p>
            </div>
            <div>
              <p className='text-sm font-medium text-gray-700'>Credits Used</p>
              <p className='text-lg font-semibold text-gray-600'>
                {creditsUsed.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Credit usage percentage bar */}
          <div className='pt-2'>
            <div className='flex justify-between text-sm text-gray-600 mb-1'>
              <span>Total Credits: {totalCredits.toLocaleString()}</span>
              <span>
                {Math.round((creditsUsed / totalCredits) * 100)}% used
              </span>
            </div>
            <div className='w-full bg-gray-200 rounded-full h-2'>
              <div
                className='bg-blue-600 h-2 rounded-full transition-all duration-300'
                style={{ width: `${(creditsUsed / totalCredits) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Credit usage explanation */}
          <div className='mt-4 p-3 bg-blue-50 rounded-lg'>
            <p className='text-sm text-blue-800'>
              💡 <strong>How credits work:</strong> Each web scraping task
              (scrape, screenshot, search, etc.) uses 1 credit.
              {currentPlan === 'free'
                ? ' Free plan gives you 1,000 lifetime credits (no monthly reset). Upgrade to Pro for 5,000 monthly credits!'
                : currentPlan === 'pro'
                ? ' Your Pro plan credits reset to 5,000 every month.'
                : ''}
            </p>
          </div>

          {/* Low credits warning */}
          {availableCredits < 100 && currentPlan === 'free' && (
            <div className='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
              <p className='text-sm text-yellow-800'>
                ⚠️ <strong>Running low on credits!</strong> You have{' '}
                {availableCredits} credits remaining. Consider upgrading to Pro
                for 5,000 monthly credits.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UserInfo() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <Card className='mb-8'>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div>
            <p className='font-medium'>Name</p>
            <p className='text-sm text-muted-foreground'>
              {user?.name || 'Not set'}
            </p>
          </div>
          <div>
            <p className='font-medium'>Email</p>
            <p className='text-sm text-muted-foreground'>{user?.email}</p>
          </div>
          <div>
            <p className='font-medium'>Account Created</p>
            <p className='text-sm text-muted-foreground'>
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserInfoSkeleton() {
  return (
    <Card className='mb-8 h-[140px]'>
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className='animate-pulse space-y-4 mt-1'>
          <div className='space-y-2'>
            <div className='h-4 w-16 bg-gray-200 rounded'></div>
            <div className='h-3 w-32 bg-gray-200 rounded'></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <section className='flex-1 p-4 lg:p-8'>
      <h1 className='text-lg lg:text-2xl font-medium mb-6'>Dashboard</h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<UserInfoSkeleton />}>
        <UserInfo />
      </Suspense>
    </section>
  );
}
