# Stripe Payment Integration - Individual Customers

This implementation provides Stripe payment functionality for individual customers (no team structure).

## Key Changes from Team-based Setup

1. **User-based subscriptions**: Each user has their own Stripe customer ID and subscription
2. **Simplified schema**: Added Stripe fields directly to the user table
3. **Database migration**: Use `npx drizzle-kit generate` and `npx drizzle-kit push` to apply schema changes

## Database Schema

The `user` table now includes:

- `stripeCustomerId`: Unique Stripe customer ID
- `stripeSubscriptionId`: Unique Stripe subscription ID
- `stripeProductId`: Stripe product ID for the user's plan
- `planName`: Human-readable plan name
- `subscriptionStatus`: Current subscription status (active, trialing, canceled, etc.)

## Usage Examples

### Creating a Checkout Session

```typescript
import { createCheckoutSession } from '@/lib/payments/stripe';
import { getUser } from '@/lib/db2/queries';

// Get current user (you'll need to implement proper auth)
const user = await getUser();

// Create checkout session
await createCheckoutSession({
  user,
  priceId: 'price_1234567890', // Your Stripe price ID
});
```

### Creating Customer Portal Session

```typescript
import { createCustomerPortalSession } from '@/lib/payments/stripe';

const portalSession = await createCustomerPortalSession(user);
// Redirect to portalSession.url
```

### Handling Webhooks

```typescript
import { handleSubscriptionChange } from '@/lib/payments/stripe';

// In your webhook handler
await handleSubscriptionChange(stripeSubscription);
```

## Required Environment Variables

```env
STRIPE_SECRET_KEY=sk_test_...
BASE_URL=http://localhost:3000
TURSO_CONNECTION_URL=...
TURSO_AUTH_TOKEN=...
```

## TODO: Authentication Integration

The `getUser()` function in `src/lib/db2/queries.ts` needs to be implemented based on your authentication system. This should return the current authenticated user or null.

## Migration

To apply the schema changes to your database:

```bash
npx drizzle-kit generate
npx drizzle-kit push
```
