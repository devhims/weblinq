# Polar Payment Integration - Individual Customers

This implementation provides Polar payment functionality for individual customers using Better Auth integration.

## Key Features

1. **Credit-based billing system**: Users get credits that are consumed per API call
2. **Polar checkout integration**: Seamless checkout experience via Polar
3. **Webhook handling**: Automatic subscription and credit management
4. **Customer portal**: Users can manage their subscriptions through Polar's portal

## Database Schema

The system uses several tables to manage billing:

- `subscriptions`: Stores Polar subscription data
- `creditBalances`: Fast lookup table for user credit balances
- `creditTransactions`: Immutable ledger of all credit transactions
- `payments`: Payment records from Polar

## Usage Examples

### Initiating Checkout

```typescript
import { authClient } from '@/lib/auth-client';

// Direct checkout using Better Auth + Polar
await authClient.checkout({
  slug: 'pro', // Matches the slug configured in auth.ts
});
```

### Accessing Customer Portal

```typescript
import { authClient } from '@/lib/auth-client';

// Redirect to Polar customer portal
await authClient.customer.portal();
```

### Checking User Credits

```typescript
import { getUserCreditInfo } from '@/lib/payments/actions';

const creditInfo = await getUserCreditInfo();
console.log('Available credits:', creditInfo?.credits?.balance);
```

### Deducting Credits

```typescript
import { checkAndDeductCredits } from '@/lib/payments/actions';

await checkAndDeductCredits('api_call', 1, {
  endpoint: '/api/scrape',
  url: 'https://example.com',
});
```

## Required Environment Variables

```env
POLAR_ACCESS_TOKEN=polar_at_...
POLAR_WEBHOOK_SECRET=whsec_...
POLAR_PRO_PRODUCT_ID=01234567-89ab-cdef-0123-456789abcdef
POLAR_ENVIRONMENT=sandbox # or 'production'
BETTER_AUTH_SECRET=your_secret_here
```

## Credit System

- **Free plan**: 1,000 lifetime credits
- **Pro plan**: 5,000 credits per month (auto-refilled)
- **Credit costs**: Most operations cost 1 credit each

## Webhook Handling

The system automatically handles Polar webhooks for:

- `subscription.created` → Add credits and update user plan
- `subscription.updated` → Update subscription status
- `subscription.canceled` → Downgrade user plan

## Migration

The database schema is managed by Drizzle ORM. To apply changes:

```bash
cd frontend
npx drizzle-kit generate
npx drizzle-kit push
```

## File Structure

```
frontend/src/lib/payments/
├── actions.ts        # Server actions for payment operations
└── README.md        # This file

frontend/src/app/(dashboard)/dashboard/
├── pricing/         # Pricing page and components
├── billing/         # Billing management page
└── success/         # Post-checkout success page
```
