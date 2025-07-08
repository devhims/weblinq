'use client';

import React, { useEffect, useState } from 'react';
import { userApi } from '@/lib/studio-api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession, authClient } from '@/lib/auth-client';
import { Suspense } from 'react';

interface CreditInfo {
  balance: number;
  plan: 'free' | 'pro';
  lastRefill: string | null;
}

function SubscriptionSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function ManageSubscription() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState<{
    balance: number;
    plan: 'free' | 'pro';
    lastRefill: string | null;
  } | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Fetch credit balance                                               */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    (async () => {
      if (!session?.user?.id) return setLoading(false);

      try {
        console.log('🔄 Loading credit info for user:', session?.user?.id);
        const creditData = await userApi.getCredits();
        if (creditData?.success) {
          setCreditInfo(creditData.data);
        }
        console.log('✅ Credit info loaded:', creditData);
      } catch (err) {
        console.error('❌ Credit fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  if (loading) return <SubscriptionSkeleton />;

  /* ------------------------------------------------------------------ */
  /*  Derive plan + usage                                                */
  /* ------------------------------------------------------------------ */
  const plan = creditInfo?.plan || 'free';
  const balance = creditInfo?.balance || 0;

  const planDisplay = plan === 'pro' ? 'Pro' : 'Free';
  const planStatus = plan === 'pro' ? 'Active subscription' : 'Free plan';

  const quota = plan === 'pro' ? 5000 : 1000;
  const used = Math.max(0, quota - balance);
  const usedPct = Math.round((used / quota) * 100);

  const handleManageSubscription = async () => {
    try {
      // Use Better Auth's built-in customer portal method - much cleaner!
      await authClient.customer.portal();
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to access customer portal. Please try again.');
    }
  };

  /* ------------------------------------------------------------------ */
  /*  UI                                                                 */
  /* ------------------------------------------------------------------ */
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Plan & actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <p className="font-medium flex items-center gap-2">
              Current Plan: {planDisplay}
              {plan === 'pro' && (
                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-2.5 py-0.5 text-xs font-medium text-white">
                  PRO
                </span>
              )}
            </p>
            <p className="text-sm text-muted-foreground">{planStatus}</p>
            {plan === 'free' && (
              <p className="text-sm text-blue-600 mt-1">
                Upgrade to Pro for 5× more credits (5 000 / month)
              </p>
            )}
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0">
            {plan === 'free' && (
              <Button asChild>
                <a href="/dashboard/pricing">Upgrade to Pro</a>
              </Button>
            )}
            {plan === 'pro' && (
              <Button variant="outline" onClick={handleManageSubscription}>
                Manage Subscription
              </Button>
            )}
          </div>
        </div>

        {/* Credits quick stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <Stat
            label="Available Credits"
            value={balance}
            accent="text-green-600"
          />
          <Stat label="Credits Used" value={used} />
        </div>

        {/* Usage bar */}
        <UsageBar usedPct={usedPct} quota={quota} />

        {/* Helper tips */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          💡 <strong>How credits work:</strong> each scrape/search uses 1
          credit.
          {plan === 'free'
            ? ' Free plan gives you 1 000 lifetime credits. Upgrade to Pro for 5 000 credits every month.'
            : ' Your credits reset to 5 000 every month.'}
        </div>

        {/* Low balance warning */}
        {plan === 'free' && balance < 100 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            ⚠️ You have only {balance} credits left. Consider upgrading to Pro.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserInfo() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <p className="font-medium">Name</p>
            <p className="text-sm text-muted-foreground">
              {user?.name || 'Not set'}
            </p>
          </div>
          <div>
            <p className="font-medium">Email</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <p className="font-medium">Account Created</p>
            <p className="text-sm text-muted-foreground">
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
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Account Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="space-y-2">
            <div className="h-4 w-16 bg-gray-200 rounded"></div>
            <div className="h-3 w-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* --- helpers ------------------------------------------------------- */

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? 'text-gray-600'}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function UsageBar({ usedPct, quota }: { usedPct: number; quota: number }) {
  return (
    <div className="pt-2">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>Total Credits: {quota.toLocaleString()}</span>
        <span>{usedPct}% used</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${usedPct}%` }}
        />
      </div>
    </div>
  );
}

export default function BillingPageClient() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Billing & Usage</h1>
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<UserInfoSkeleton />}>
        <UserInfo />
      </Suspense>
    </section>
  );
}
