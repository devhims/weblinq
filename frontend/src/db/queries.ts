import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import { user, userCredits, creditUsage, polarSubscription } from './schema';

export type User = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  stripeCustomerId?: string | null;
};

export async function getUserById(userId: string) {
  try {
    const [currentUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    return currentUser || null;
  } catch (error) {
    console.error('Error getting user by id:', error);
    return null;
  }
}

// Credits Management - matching the existing dashboard structure
export async function getUserCredits(userId: string) {
  try {
    // Get or create user credits record
    let [userCredit] = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1);

    if (!userCredit) {
      // Create initial credits record for new user
      await db.insert(userCredits).values({
        userId,
        credits: 1000, // Free plan starts with 1000 credits
        creditsUsed: 0,
        planName: 'free',
      });

      [userCredit] = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);
    }

    const availableCredits = userCredit!.credits - userCredit!.creditsUsed;

    return {
      credits: userCredit!.credits,
      creditsUsed: userCredit!.creditsUsed,
      availableCredits,
      planName: userCredit!.planName,
      lastReset: userCredit!.lastReset,
    };
  } catch (error) {
    console.error('Error getting user credits:', error);
    return null;
  }
}

export async function deductCredits(
  userId: string,
  creditsToDeduct: number,
  operation: string,
  metadata?: any
) {
  try {
    const userCredit = await getUserCredits(userId);

    if (!userCredit) {
      throw new Error('User credits not found');
    }

    if (userCredit.availableCredits < creditsToDeduct) {
      throw new Error('Insufficient credits');
    }

    await db.transaction(async (tx) => {
      // Update credits used
      await tx
        .update(userCredits)
        .set({
          creditsUsed: userCredit.creditsUsed + creditsToDeduct,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, userId));

      // Log the usage
      await tx.insert(creditUsage).values({
        userId,
        operation,
        creditsUsed: creditsToDeduct,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    });

    return true;
  } catch (error) {
    console.error('Error deducting credits:', error);
    throw error;
  }
}

export async function getCreditUsageHistory(userId: string, limit = 50) {
  try {
    const usageHistory = await db
      .select()
      .from(creditUsage)
      .where(eq(creditUsage.userId, userId))
      .orderBy(desc(creditUsage.createdAt))
      .limit(limit);

    return usageHistory.map((usage) => ({
      ...usage,
      metadata: usage.metadata ? JSON.parse(usage.metadata) : null,
    }));
  } catch (error) {
    console.error('Error getting credit usage history:', error);
    return [];
  }
}

// Polar Subscription Management
export async function getPolarSubscription(userId: string) {
  try {
    const [subscription] = await db
      .select()
      .from(polarSubscription)
      .where(
        and(
          eq(polarSubscription.userId, userId),
          eq(polarSubscription.status, 'active')
        )
      )
      .limit(1);

    return subscription || null;
  } catch (error) {
    console.error('Error getting Polar subscription:', error);
    return null;
  }
}

export async function createOrUpdatePolarSubscription(subscriptionData: {
  userId: string;
  polarCustomerId: string;
  subscriptionId: string;
  status: string;
  planName: string;
  productId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}) {
  try {
    // Get existing credits and subscription to determine if this is a plan change
    const [currentCredits, existingSubscription] = await Promise.all([
      getUserCredits(subscriptionData.userId),
      db
        .select()
        .from(polarSubscription)
        .where(
          eq(polarSubscription.subscriptionId, subscriptionData.subscriptionId)
        )
        .limit(1)
        .then((rows) => rows[0] || null),
    ]);

    // Determine if this is a plan change (upgrade/downgrade) or just a status update
    const isNewSubscription = !existingSubscription;
    const isPlanChange =
      currentCredits && currentCredits.planName !== subscriptionData.planName;
    const isStatusUpdate =
      existingSubscription &&
      existingSubscription.status !== subscriptionData.status &&
      currentCredits?.planName === subscriptionData.planName;

    console.log(`🔍 Subscription analysis for ${subscriptionData.userId}:`, {
      isNewSubscription,
      isPlanChange,
      isStatusUpdate,
      oldPlan: currentCredits?.planName,
      newPlan: subscriptionData.planName,
      oldStatus: existingSubscription?.status,
      newStatus: subscriptionData.status,
    });

    // Always try to update first, then insert if it doesn't exist
    const updateResult = await db
      .update(polarSubscription)
      .set({
        ...subscriptionData,
        updatedAt: new Date(),
      })
      .where(
        eq(polarSubscription.subscriptionId, subscriptionData.subscriptionId)
      )
      .returning();

    if (updateResult.length === 0) {
      // No existing record found, create new one
      try {
        await db.insert(polarSubscription).values(subscriptionData);
        console.log(
          `✅ Created new subscription record for ${subscriptionData.subscriptionId}`
        );
      } catch (error: any) {
        // If unique constraint fails, it means another webhook created it simultaneously
        if (error.code === 'SQLITE_CONSTRAINT') {
          console.log(
            `⚠️ Subscription ${subscriptionData.subscriptionId} already exists, skipping insert`
          );
        } else {
          throw error;
        }
      }
    } else {
      console.log(
        `✅ Updated existing subscription record for ${subscriptionData.subscriptionId}`
      );
    }

    // Only update credits for new subscriptions or actual plan changes
    if (isNewSubscription || isPlanChange) {
      console.log(
        `💳 Processing credit changes (new subscription or plan change)`
      );

      const newTotalCredits = subscriptionData.planName === 'pro' ? 5000 : 1000;

      // Credit logic: Fresh start on upgrades/renewals
      let finalCredits = newTotalCredits;
      let finalCreditsUsed = 0; // Always reset usage on plan changes

      if (currentCredits && subscriptionData.planName === 'pro') {
        // Pro subscription: Give fresh 5000 credits + preserve any unused credits
        const remainingCredits = currentCredits.availableCredits;
        finalCredits = newTotalCredits + remainingCredits;
        // finalCreditsUsed stays 0 (fresh start)

        console.log(
          `🎯 Pro upgrade: ${newTotalCredits} new + ${remainingCredits} preserved = ${finalCredits} total credits`
        );
      } else if (currentCredits && subscriptionData.planName === 'free') {
        // Downgrading to free: preserve current state but cap total at 1000
        finalCredits = Math.max(currentCredits.credits, 1000);
        finalCreditsUsed = currentCredits.creditsUsed; // Keep usage for downgrades

        console.log(
          `⬇️ Downgrade to free: ${finalCredits} total, ${finalCreditsUsed} used`
        );
      }

      await db
        .update(userCredits)
        .set({
          planName: subscriptionData.planName,
          credits: finalCredits,
          creditsUsed: finalCreditsUsed,
          lastReset: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, subscriptionData.userId));

      console.log(
        `💰 Updated credits for user ${
          subscriptionData.userId
        }: ${finalCredits} total, ${finalCreditsUsed} used, ${
          finalCredits - finalCreditsUsed
        } available`
      );
    } else if (isStatusUpdate) {
      console.log(`📊 Status update only - no credit changes needed`);

      // For status updates (like reactivation), just update the plan name to match subscription
      if (currentCredits?.planName !== subscriptionData.planName) {
        await db
          .update(userCredits)
          .set({
            planName: subscriptionData.planName,
            updatedAt: new Date(),
          })
          .where(eq(userCredits.userId, subscriptionData.userId));

        console.log(
          `📝 Updated plan name to ${subscriptionData.planName} without changing credits`
        );
      }
    } else {
      console.log(
        `⏸️ No credit update needed - subscription status update only`
      );
    }

    return true;
  } catch (error) {
    console.error('❌ Error creating/updating Polar subscription:', error);
    throw error;
  }
}

// Function to get subscription status for the existing dashboard
export async function getSubscriptionData(userId: string) {
  try {
    const [userCredit, polarSub] = await Promise.all([
      getUserCredits(userId),
      getPolarSubscription(userId),
    ]);

    return {
      hasActiveSubscription: !!polarSub,
      currentPlan: userCredit?.planName || 'free',
      credits: userCredit,
      polarSubscription: polarSub,
    };
  } catch (error) {
    console.error('Error getting subscription data:', error);
    return {
      hasActiveSubscription: false,
      currentPlan: 'free',
      credits: null,
      polarSubscription: null,
    };
  }
}
