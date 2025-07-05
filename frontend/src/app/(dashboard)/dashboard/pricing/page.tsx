'use client';

import { Check, MessageSquare, CreditCard } from 'lucide-react';
import { authClient, useSession } from '@/lib/auth-client';
import { DebugPolar } from './debug-polar';
import { useEffect, useState } from 'react';
import { getUserCreditInfo } from '@/lib/payments/actions';

// Pricing plans with credit-based system for web scraping
const PLANS = [
  {
    name: 'Free',
    planId: 'free',
    type: 'free' as const,
    price: 0,
    credits: 1000,
    features: [
      '1,000 Lifetime Credits',
      'Web Scraping (Markdown, HTML, Links)',
      'Visual Capture (Screenshots, PDF)',
      'Structured Data Extraction (JSON)',
      'Web Search',
      'Community Support',
      'Basic Analytics',
    ],
  },
  {
    name: 'Pro',
    planId: 'pro',
    type: 'subscription' as const,
    price: 2000, // $20.00 in cents
    credits: 5000,
    features: [
      '5,000 Credits per month',
      'All Free plan features',
      'Monthly credit renewal',
      'Priority Processing',
      'Advanced Analytics',
      'API Access',
      'Priority Support',
      'Custom Headers & Options',
    ],
  },
  {
    name: 'Enterprise',
    planId: 'enterprise',
    type: 'contact' as const,
    price: null,
    credits: null,
    features: [
      'Unlimited Credits',
      'All Pro plan features',
      'Dedicated Infrastructure',
      '24/7 Dedicated Support',
      'Custom Features',
      'SLA Guarantee',
      'On-premise Deployment',
      'Dedicated Account Manager',
      'Custom Integrations',
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const [customerState, setCustomerState] = useState<any>(null);
  const [creditInfo, setCreditInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      loadSubscriptionInfo();
    } else {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const loadSubscriptionInfo = async () => {
    try {
      // Get Polar customer state and credit info in parallel
      const [polarState, userCreditInfo] = await Promise.all([authClient.customer.state(), getUserCreditInfo()]);

      setCustomerState(polarState.data);
      setCreditInfo(userCreditInfo);
    } catch (error) {
      console.error('Error loading subscription info:', error);
    } finally {
      setLoading(false);
    }
  };

  // Determine current plan from Polar customer state
  const activeSub = customerState?.subscriptions?.[0];
  const currentPlan = activeSub?.status === 'active' ? 'pro' : 'free';
  const hasActiveSubscription = activeSub?.status === 'active';

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Plan</h1>
        <p className="text-lg text-gray-600 mb-4">
          Start free, upgrade when you need more. No credit card required to get started.
        </p>

        {/* Current Plan Status */}
        {!loading && session?.user && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm">
                You're currently on the <strong className="capitalize">{currentPlan}</strong> plan
                {hasActiveSubscription && (
                  <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active Subscription
                  </span>
                )}
              </p>
              {creditInfo?.credits && (
                <p className="text-green-600 text-sm mt-1">{creditInfo.credits.balance} credits available</p>
              )}
            </div>
          </div>
        )}

        {/* Payment Information */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-700 text-sm">Payments processed securely with Polar</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
        {PLANS.map((plan) => (
          <PricingCard
            key={plan.planId}
            {...plan}
            currentPlan={currentPlan}
            hasActiveSubscription={hasActiveSubscription}
          />
        ))}
      </div>

      {/* Debug component for development */}
      <DebugPolar />
    </main>
  );
}

function PricingCard({
  name,
  planId,
  type,
  price,
  credits,
  features,
  currentPlan,
  hasActiveSubscription,
}: {
  name: string;
  planId: string;
  type: 'free' | 'subscription' | 'contact';
  price: number | null;
  credits: number | null;
  features: string[];
  currentPlan?: string | null;
  hasActiveSubscription?: boolean;
}) {
  const isPopular = planId === 'pro';
  const isCurrentPlan = currentPlan === planId;
  const isCurrentlySubscribed = hasActiveSubscription && planId === 'pro';

  return (
    <div
      className={`border-2 rounded-lg p-8 relative ${isPopular ? 'border-orange-500 shadow-lg' : 'border-gray-200'} ${
        isCurrentPlan ? 'ring-2 ring-green-500' : ''
      }`}
    >
      {isPopular && (
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <span className="bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-medium">Most Popular</span>
        </div>
      )}

      {isCurrentPlan && (
        <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2">
          <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">Current Plan</span>
        </div>
      )}

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{name}</h2>
        <div className="mb-4">
          {price === null ? (
            <p className="text-3xl font-bold text-gray-900">Custom Pricing</p>
          ) : price === 0 ? (
            <p className="text-4xl font-bold text-gray-900">Free</p>
          ) : (
            <p className="text-4xl font-bold text-gray-900">
              ${price / 100}
              <span className="text-lg font-normal text-gray-600">/month</span>
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-4 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <Check className="h-5 w-5 text-orange-500 mr-3 mt-0.5 flex-shrink-0" />
            <span className="text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="w-full">
        {type === 'free' && (
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              {isCurrentPlan
                ? "You're currently on the Free plan"
                : "You're automatically on the Free plan when you sign up"}
            </p>
            <div className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium">
              {isCurrentPlan ? 'Current Plan' : 'Free Plan'}
            </div>
          </div>
        )}

        {type === 'subscription' && (
          <div className="w-full space-y-3">
            {isCurrentlySubscribed ? (
              <div className="text-center">
                <div className="w-full py-3 px-4 bg-green-100 text-green-700 rounded-lg font-medium mb-3">
                  ✓ Active Subscription
                </div>
                <button
                  onClick={async () => {
                    try {
                      await authClient.customer.portal();
                    } catch (error) {
                      console.error('Portal error:', error);
                    }
                  }}
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Manage Subscription
                </button>
              </div>
            ) : (
              <>
                {/* Use client-side checkout for better UX */}
                <button
                  onClick={async () => {
                    try {
                      // Use client-side checkout which will redirect to Polar
                      await authClient.checkout({
                        slug: 'pro', // This matches the slug in auth.ts
                      });
                    } catch (error) {
                      console.error('Checkout error:', error);
                      // Handle error - could show toast notification
                    }
                  }}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center rounded-full"
                >
                  {currentPlan === 'free' ? 'Upgrade to Pro' : 'Get Started'}
                  <Check className="ml-2 h-4 w-4" />
                </button>

                <div className="text-center">
                  <div className="flex items-center justify-center text-xs text-gray-500">
                    <CreditCard className="h-3 w-3 mr-1" />
                    <span>Powered by Polar</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Credit Card, Bank Transfer, Digital Wallets</p>
                </div>
              </>
            )}
          </div>
        )}

        {type === 'contact' && <ContactButton />}
      </div>
    </div>
  );
}

function ContactButton() {
  return (
    <button
      onClick={() => {
        // You can replace this with your preferred contact method
        window.open('mailto:sales@yourcompany.com?subject=Enterprise Plan Inquiry', '_blank');
      }}
      className="w-full bg-gray-900 hover:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
    >
      <MessageSquare className="mr-2 h-4 w-4" />
      Contact Sales
    </button>
  );
}
