'use client';

import {
  Check,
  MessageSquare,
  CreditCard,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { useSession, authClient } from '@/lib/auth-client';
import { useEffect, useState } from 'react';
import { userApi } from '@/lib/studio-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PRICING_PLANS,
  formatPrice,
  formatCredits,
  type PricingPlan,
} from '@/lib/utils/pricing-plans';
import { cn } from '@/lib/utils';

export default function PricingPage() {
  const { data: session } = useSession();
  const [creditInfo, setCreditInfo] = useState<{
    balance: number;
    plan: 'free' | 'pro';
    lastRefill: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadCreditInfo();
    } else {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const loadCreditInfo = async () => {
    try {
      const creditData = await userApi.getCredits();
      if (creditData?.success) {
        setCreditInfo(creditData.data);
      }
    } catch (error) {
      console.error('Error loading credit info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine current plan from credit info
  const currentPlan = creditInfo?.plan || 'free';
  const hasActiveSubscription = currentPlan === 'pro';

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-12">
            <TrendingUp className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-3xl font-bold text-foreground">
              Choose Your Plan
            </h1>
          </div>

          {/* Pricing Cards */}
          <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {PRICING_PLANS.map((plan) => (
              <PricingCard
                key={plan.id}
                plan={plan}
                currentPlan={currentPlan}
                hasActiveSubscription={hasActiveSubscription}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function PricingCard({
  plan,
  currentPlan,
  hasActiveSubscription,
}: {
  plan: PricingPlan;
  currentPlan?: string | null;
  hasActiveSubscription?: boolean;
}) {
  const isPopular = plan.highlighted;
  const isCurrentPlan = currentPlan === plan.id;
  const isCurrentlySubscribed = hasActiveSubscription && plan.id === 'pro';

  const handleCheckout = async () => {
    try {
      await authClient.checkout({
        slug: plan.planSlug || 'pro',
      });
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
    }
  };

  const handlePortal = async () => {
    try {
      await authClient.customer.portal();
    } catch (error) {
      console.error('Portal error:', error);
      alert('Failed to access customer portal. Please try again.');
    }
  };

  const handleContact = () => {
    window.open(
      'mailto:sales@weblinq.dev?subject=Enterprise Plan Inquiry',
      '_blank',
    );
  };

  return (
    <Card
      className={cn(
        'relative transition-all duration-200 hover:shadow-lg flex flex-col',
        isPopular && 'border-primary shadow-lg scale-105',
      )}
    >
      {isPopular && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Badge className="bg-primary hover:bg-primary text-primary-foreground px-4 py-1">
            <Zap className="h-3 w-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute -top-3 -right-3 z-10">
          <Badge className="bg-green-600 hover:bg-green-700 text-white">
            Current Plan
          </Badge>
        </div>
      )}

      <CardHeader className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          {plan.icon && <plan.icon className="h-6 w-6 text-primary" />}
          <CardTitle className="text-2xl">{plan.name}</CardTitle>
        </div>

        <div className="space-y-2">
          <div className="text-3xl font-bold text-foreground">
            {formatPrice(plan.price)}
            {plan.price !== null && plan.price > 0 && (
              <span className="text-lg font-normal text-muted-foreground">
                /month
              </span>
            )}
          </div>
          {/* 
          {plan.credits && (
            <p className="text-muted-foreground">
              {formatCredits(plan.credits)} credits
              {plan.type === 'subscription' ? ' per month' : ' lifetime'}
            </p>
          )}
          {plan.credits === null && (
            <p className="text-muted-foreground">Unlimited usage</p>
          )} */}

          <p className="text-sm text-muted-foreground">{plan.description}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Features List */}
        <ul className="space-y-3 flex-1">
          {plan.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">{feature}</span>
            </li>
          ))}
        </ul>

        {/* Action Button */}
        <div className="pt-4 mt-auto">
          {plan.type === 'free' && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {isCurrentPlan
                  ? "You're currently on the Free plan"
                  : 'Automatically included when you sign up'}
              </p>
              <Button variant="outline" className="w-full" disabled>
                {isCurrentPlan ? 'Current Plan' : 'Free Plan'}
              </Button>
            </div>
          )}

          {plan.type === 'subscription' && (
            <div className="space-y-3">
              {isCurrentlySubscribed ? (
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
                    disabled
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Active Subscription
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handlePortal}
                    className="w-full"
                    size="sm"
                  >
                    Manage Subscription
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    onClick={handleCheckout}
                    className={cn(
                      'w-full font-medium transition-all',
                      isPopular
                        ? 'bg-primary hover:bg-primary/90'
                        : 'bg-primary hover:bg-primary/90',
                    )}
                  >
                    {currentPlan === 'free' ? 'Upgrade to Pro' : 'Get Started'}
                    <TrendingUp className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="text-center">
                    <div className="flex items-center justify-center text-xs text-muted-foreground gap-1">
                      <CreditCard className="h-3 w-3" />
                      <span>Powered by Polar</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Credit Card, Bank Transfer, Digital Wallets
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {plan.type === 'contact' && (
            <Button
              onClick={handleContact}
              variant="outline"
              className="w-full font-medium"
            >
              Contact Sales
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
