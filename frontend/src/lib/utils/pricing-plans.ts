import { Check, Zap, Building2, User } from 'lucide-react';

export type PlanType = 'free' | 'subscription' | 'contact';
export type PlanId = 'free' | 'pro' | 'enterprise';

export interface PricingPlan {
  id: PlanId;
  name: string;
  type: PlanType;
  price: number | null; // in cents, null for custom pricing
  credits: number | null; // null for unlimited
  description: string;
  features: string[];
  highlighted?: boolean;
  icon?: any; // Lucide icon component
  // Billing-specific properties
  planSlug?: string; // for checkout integration
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    type: 'free',
    price: 0,
    credits: 1000,
    description: 'Perfect for getting started',
    icon: User,
    features: [
      '1,000 Lifetime Credits',
      'Up to 2 concurrent requests',
      'Web Scraping (Markdown, HTML, Links) API',
      'Visual Capture (Screenshots, PDF) API',
      'AI Extraction (JSON support) API',
      'Web Search API',
      'Basic Analytics',
      'Limited logging & monitoring',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    type: 'subscription',
    price: 2000, // $20.00 in cents
    credits: 5000,
    description: 'Best for growing businesses',
    planSlug: 'pro', // matches backend auth.ts
    highlighted: true,
    icon: Zap,
    features: [
      '5,000 credits / month',
      'All Free Plan Features',
      'Monthly Credit Renewal',
      'Up to 10 Concurrent Requests',
      'Priority Email Support',
      'Custom Headers & Options',
      'Early Access to New Features',
      'Advanced Usage Dashboard',
      'Overage Alerts & Usage Thresholds',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    type: 'contact',
    price: null,
    credits: null,
    description: 'For large-scale operations',
    icon: Building2,
    features: [
      'All Pro plan features',
      'Customizable concurrent requests',
      'Dedicated Infrastructure or Region',
      '24/7 Support',
      'Custom Features',
      'Dedicated Account Manager',
      'Custom API integrations',
      'SLA & compliance support',
      'Monthly strategy calls',
    ],
  },
];

// Helper functions
export const getPlanById = (id: PlanId): PricingPlan | undefined => {
  return PRICING_PLANS.find((plan) => plan.id === id);
};

export const getPlanByType = (type: PlanType): PricingPlan[] => {
  return PRICING_PLANS.filter((plan) => plan.type === type);
};

export const formatPrice = (price: number | null): string => {
  if (price === null) return 'Custom Pricing';
  if (price === 0) return 'Free Forever';
  return `$${price / 100}`;
};

export const formatCredits = (credits: number | null): string => {
  if (credits === null) return 'Unlimited';
  return credits.toLocaleString();
};
