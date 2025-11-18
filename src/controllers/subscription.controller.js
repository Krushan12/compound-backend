import { body } from 'express-validator';
import { success } from '../utils/response.js';
import * as SubscriptionService from '../services/subscription.service.js';

export const createSubscriptionValidators = [
  body('plan').isIn(['monthly', 'quarterly', 'yearly']).withMessage('Invalid plan'),
  body('amount').isFloat({ min: 0 }).withMessage('Invalid amount'),
];

/**
 * Create or update subscription
 */
export const createSubscription = async (req, res) => {
  const { plan, amount } = req.body;
  const userId = req.user.id;

  const subscription = await SubscriptionService.createOrUpdateSubscription(userId, {
    plan,
    amount,
  });

  return success(res, { subscription }, 'Subscription created successfully');
};

/**
 * Get user subscription
 */
export const getSubscription = async (req, res) => {
  const userId = req.user.id;
  const subscription = await SubscriptionService.getUserSubscription(userId);
  
  return success(res, { subscription }, 'Subscription retrieved');
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  const userId = req.user.id;
  const subscription = await SubscriptionService.cancelSubscription(userId);
  
  return success(res, { subscription }, 'Subscription cancelled');
};

export default { createSubscription, getSubscription, cancelSubscription };
