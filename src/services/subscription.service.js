import prisma from '../config/db.js';

/**
 * Create or update subscription
 */
export const createOrUpdateSubscription = async (userId, { plan, amount, tier = 'basic' }) => {
  // Calculate expiry date based on plan
  const now = new Date();
  let expiresAt;
  
  switch (plan) {
    case 'monthly':
      expiresAt = new Date(now.setMonth(now.getMonth() + 1));
      break;
    case 'quarterly':
      expiresAt = new Date(now.setMonth(now.getMonth() + 3));
      break;
    case 'yearly':
      expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
      break;
    default:
      throw new Error('Invalid plan type');
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    update: {
      status: 'ACTIVE',
      plan,
      amount,
      tier,
      startedAt: new Date(),
      expiresAt,
    },
    create: {
      userId,
      status: 'ACTIVE',
      plan,
      amount,
      tier,
      startedAt: new Date(),
      expiresAt,
    },
  });

  return subscription;
};

/**
 * Get user subscription
 */
export const getUserSubscription = async (userId) => {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      userId: true,
      status: true,
      plan: true,
      amount: true,
      startedAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      tier: true,
    },
  });
  
  // Check if subscription is expired
  if (subscription && subscription.expiresAt) {
    const now = new Date();
    if (now > subscription.expiresAt) {
      // Mark as expired
      await prisma.subscription.update({
        where: { userId },
        data: { status: 'EXPIRED' },
      });
      return { ...subscription, status: 'EXPIRED' };
    }
  }
  
  return subscription;
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (userId) => {
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (!existing) {
    // Nothing to cancel; treat as already inactive
    return null;
  }
  const subscription = await prisma.subscription.update({
    where: { userId },
    data: { status: 'CANCELLED' },
  });
  return subscription;
};

export default { createOrUpdateSubscription, getUserSubscription, cancelSubscription };
