'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createCustomerPortalSession } from '@/lib/payments/actions';
import { authClient, useSession } from '@/lib/auth-client';
import { Suspense } from 'react';
import React from 'react';

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
  const [loading, setLoading] = React.useState(true);
  const [customerState, setCustomerState] = React.useState<any>(null); // Polar state
  const [credits, setCredits] = React.useState<number>(0);

  /* ------------------------------------------------------------------ */
  /*  Fetch Polar + credit balance                                       */
  /* ------------------------------------------------------------------ */
  React.useEffect(() => {
    (async () => {
      if (!session?.user?.id) return setLoading(false);

      try {
        // 1️⃣ Polar customer state: subs, meters, benefits
        const { data: state } = await authClient.customer.state();
        setCustomerState(state);

        // 2️⃣ Credit cache from your DB (fast) – optional
        const { balance } = await fetch('/api/user/credits').then((r) => r.json());
        setCredits(balance);
      } catch (err) {
        console.error('Billing fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  if (loading) return <SubscriptionSkeleton />;

  /* ------------------------------------------------------------------ */
  /*  Derive plan + usage                                                */
  /* ------------------------------------------------------------------ */
  const activeSub = customerState?.subscriptions?.[0]; // you allow 1 sub/user
  const plan: 'free' | 'pro' = activeSub?.status === 'active' ? 'pro' : 'free';

  const planDisplay = plan === 'pro' ? 'Pro' : 'Free';
  const planStatus = plan === 'pro' ? 'Active subscription' : 'Free plan';

  const balance = credits; // current spendable
  const quota = plan === 'pro' ? 5000 : 1000;
  const used = Math.max(0, quota - balance);
  const usedPct = Math.round((used / quota) * 100);

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
              <p className="text-sm text-blue-600 mt-1">Upgrade to Pro for 5× more credits (5 000 / month)</p>
            )}
          </div>

          <div className="flex gap-2 mt-4 sm:mt-0">
            {plan === 'free' && (
              <Button asChild>
                <a href="/pricing">Upgrade to Pro</a>
              </Button>
            )}
            {plan === 'pro' && (
              <Button variant="outline" onClick={() => createCustomerPortalSession().catch(console.error)}>
                Manage Subscription
              </Button>
            )}
          </div>
        </div>

        {/* Credits quick stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <Stat label="Available Credits" value={balance} accent="text-green-600" />
          <Stat label="Credits Used" value={used} />
        </div>

        {/* Usage bar */}
        <UsageBar usedPct={usedPct} quota={quota} />

        {/* Helper tips */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          💡 <strong>How credits work:</strong> each scrape/search uses 1 credit.
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
            <p className="text-sm text-muted-foreground">{user?.name || 'Not set'}</p>
          </div>
          <div>
            <p className="font-medium">Email</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div>
            <p className="font-medium">Account Created</p>
            <p className="text-sm text-muted-foreground">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <p className={`text-lg font-semibold ${accent ?? 'text-gray-600'}`}>{value.toLocaleString()}</p>
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
        <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${usedPct}%` }} />
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
