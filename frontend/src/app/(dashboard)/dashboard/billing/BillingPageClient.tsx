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
import {
  PRICING_PLANS,
  getPlanById,
  formatCredits,
} from '@/lib/utils/pricing-plans';
import {
  CreditCard,
  Zap,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Calendar,
  User,
  Mail,
  Settings,
  SquareUserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditInfo {
  balance: number;
  plan: 'free' | 'pro';
  lastRefill: string | null;
}

function SubscriptionSkeleton() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-muted animate-pulse rounded" />
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="h-16 bg-muted animate-pulse rounded" />
            <div className="h-16 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-2 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ManageSubscription() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);

  /* ------------------------------------------------------------------ */
  /*  Fetch credit balance                                               */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
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
  const currentPlan = getPlanById(plan);

  if (!currentPlan) return null;

  const quota = currentPlan.credits || 1000; // Use plan credits as total quota
  const used = Math.max(0, quota - balance);
  const usedPct = Math.round((used / quota) * 100);

  const handleManageSubscription = async () => {
    try {
      await authClient.customer.portal();
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to access customer portal. Please try again.');
    }
  };

  const isProPlan = plan === 'pro';

  /* ------------------------------------------------------------------ */
  /*  UI                                                                 */
  /* ------------------------------------------------------------------ */
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-muted-foreground" />
          Subscription & Usage
        </CardTitle>
        <CardDescription>
          Manage your plan and monitor your API usage
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan & actions */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">{currentPlan.name} Plan</h3>
              {isProPlan && (
                <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
                  <Zap className="h-3 w-3 mr-1" />
                  PRO
                </Badge>
              )}
              {!isProPlan && <Badge variant="outline">Free</Badge>}
            </div>
            <p className="text-muted-foreground">{currentPlan.description}</p>
            {!isProPlan && (
              <p className="text-sm text-blue-600 font-medium">
                💡 Upgrade to Pro for 5× more credits and advanced features
              </p>
            )}
          </div>

          <div className="flex self-start gap-3">
            {!isProPlan && (
              <Button
                asChild
                size="sm"
                className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0"
              >
                <a href="/dashboard/pricing">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </a>
              </Button>
            )}
            {isProPlan && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
              >
                <Settings className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            )}
          </div>
        </div>

        {/* Credits overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 p-4 border border-border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Available Credits
            </div>
            <p className="text-2xl font-bold text-green-600">
              {formatCredits(balance)}
            </p>
          </div>

          <div className="space-y-2 p-4 border border-border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Credits Used
            </div>
            <p className="text-2xl font-bold text-muted-foreground">
              {formatCredits(used)}
            </p>
          </div>

          {/* <div className="space-y-2 p-4 border border-border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              Total Quota
            </div>
            <p className="text-2xl font-bold text-muted-foreground">
              {formatCredits(quota)}
            </p>
          </div> */}
        </div>

        {/* Usage progress bar */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Usage Progress</span>
            <span className="font-medium">{usedPct}% used</span>
          </div>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-3 rounded-full transition-all duration-500 ease-out',
                usedPct > 80
                  ? 'bg-red-500'
                  : usedPct > 60
                    ? 'bg-yellow-500'
                    : 'bg-green-500',
              )}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Information panel */}
        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 dark:text-blue-400 mt-0.5">💡</div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                How credits work
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                Each API request (scrape, search, screenshot, etc.) uses 1
                credit.
                {isProPlan
                  ? ' Your credits reset to 5,000 every month.'
                  : ' Free plan gives you 1,000 lifetime credits. Upgrade to Pro for 5,000 credits monthly.'}
              </p>
            </div>
          </div>
        </div>

        {/* Low balance warning */}
        {!isProPlan && balance < 100 && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
                  Low credit balance
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-200">
                  You have only {formatCredits(balance)} credits remaining.
                  Consider upgrading to Pro for unlimited monthly credits.
                </p>
              </div>
            </div>
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
        <CardTitle className="flex items-center gap-3">
          <User className="h-5 w-5 text-muted-foreground" />
          Account Information
        </CardTitle>
        <CardDescription>Your account details and settings</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SquareUserRound className="h-4 w-4" />
              Full Name
            </div>
            <p className="font-medium">{user?.name || 'Not set'}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email Address
            </div>
            <p className="font-medium">{user?.email}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Member Since
            </div>
            <p className="font-medium">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
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
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 bg-muted animate-pulse rounded" />
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-4 w-48 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-5 w-32 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function BillingPageClient() {
  return (
    <section className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-lg lg:text-2xl font-medium text-foreground">
            Billing
          </h1>
        </div>
        <p className="text-muted-foreground">
          Monitor your subscription, usage, and manage billing preferences
        </p>
      </div>

      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>

      <Suspense fallback={<UserInfoSkeleton />}>
        <UserInfo />
      </Suspense>
    </section>
  );
}
