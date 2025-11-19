import { body } from 'express-validator';
import { success } from '../utils/response.js';
import * as PaymentService from '../services/payment.service.js';

export const createOrderValidators = [body('amount').isInt({ gt: 0 })];

export const createOrder = async (req, res) => {
  try {
    const { amount, couponCode } = req.body;
    const finalAmount = couponCode === 'RAINBOWMONEY' ? 10 : amount;
    console.log('🎯 Creating order for user:', req.user.id, { amount: finalAmount, couponCode });
    const out = await PaymentService.createOrder(req.user.id, Number(finalAmount));
    return success(res, out, 'Order created');
  } catch (error) {
    console.error('❌ Order creation failed:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create order',
      error: error.message 
    });
  }
};

export const webhook = async (req, res) => {
  return res.json({ success: true });
};

export const subscriptionStatus = async (req, res) => {
  const out = await PaymentService.subscriptionStatus(req.user.id);
  return success(res, out, 'Subscription status');
};

// Razorpay Subscriptions: create subscription intent (returns subscriptionId + keyId)
export const createSubscriptionIntentValidators = [
  body('plan').isIn(['monthly', 'quarterly', 'yearly']),
  body('amount').isFloat({ gt: 0 }),
];

export const createSubscriptionIntent = async (req, res) => {
  try {
    const { plan, amount, customer, couponCode } = req.body;
    const finalAmount = couponCode === 'RAINBOWMONEY' ? 10 : amount;
    console.log('🎯 Creating subscription intent for user:', req.user.id, { plan, amount: finalAmount, couponCode });
    const out = await PaymentService.createSubscription(req.user.id, { plan, amount: finalAmount, customer });
    return success(res, out, 'Subscription intent created');
  } catch (error) {
    console.error('❌ Subscription intent creation failed:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to create subscription intent',
      error: error.message 
    });
  }
};

// Verify subscription auth payment signature and activate subscription
export const verifySubscriptionValidators = [
  body('razorpay_subscription_id').isString(),
  body('razorpay_payment_id').isString(),
  body('razorpay_signature').isString(),
  body('plan').isIn(['monthly', 'quarterly', 'yearly']),
  body('amount').isFloat({ gt: 0 }),
];

export const verifySubscription = async (req, res) => {
  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan, amount } = req.body;
  const out = await PaymentService.verifySubscriptionPayment(req.user.id, {
    subscriptionId: razorpay_subscription_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    plan,
    amount,
  });
  return success(res, out, 'Subscription verified');
};

export default {
  createOrder,
  webhook,
  subscriptionStatus,
  createSubscriptionIntent,
  verifySubscription,
};
