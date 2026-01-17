import { body } from 'express-validator';
import { success } from '../utils/response.js';
import * as PaymentService from '../services/payment.service.js';

export const createOrderValidators = [
  body('amount').isFloat({ gt: 0 }),
  body('couponCode').optional().isString(),
  body('plan')
    .optional()
    .isIn(['trialOneMonth', 'monthly', 'quarterly', 'yearly', 'threeMonths', 'sixMonths', 'nineMonths']),
  body('tier').optional().isIn(['basic', 'advanced']),
];

export const createOrder = async (req, res) => {
  try {
    const { amount, couponCode, plan, tier } = req.body;
    const finalAmount = couponCode === 'RAINBOWMONEY' ? 10 : amount;
    console.log('🎯 Creating order for user:', req.user.id, { amount: finalAmount, couponCode, plan, tier });
    const out = await PaymentService.createOrder(req.user.id, Number(finalAmount), { plan, tier, couponCode });
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
  body('tier').optional().isIn(['basic', 'advanced']),
];

export const createSubscriptionIntent = async (req, res) => {
  try {
    const { plan, amount, customer, couponCode, tier } = req.body;
    const finalAmount = couponCode === 'RAINBOWMONEY' ? 10 : amount;
    console.log('🎯 Creating subscription intent for user:', req.user.id, { plan, amount: finalAmount, couponCode });
    const out = await PaymentService.createSubscription(req.user.id, { plan, amount: finalAmount, customer, tier });
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
  body('tier').optional().isIn(['basic', 'advanced']),
];

export const verifySubscription = async (req, res) => {
  const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan, amount, tier } = req.body;
  const out = await PaymentService.verifySubscriptionPayment(req.user.id, {
    subscriptionId: razorpay_subscription_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    plan,
    amount,
    tier,
  });
  return success(res, out, 'Subscription verified');
};

export const verifyOrderValidators = [
  body('razorpay_order_id').isString(),
  body('razorpay_payment_id').isString(),
  body('razorpay_signature').isString(),
  body('amount').isFloat({ gt: 0 }),
  body('plan')
    .optional()
    .isIn(['monthly', 'quarterly', 'yearly', 'threeMonths', 'sixMonths', 'nineMonths']),
  body('tier').optional().isIn(['basic', 'advanced']),
];

export const verifyOrder = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, tier, plan } = req.body;
  const out = await PaymentService.verifyOrderPayment(req.user.id, {
    orderId: razorpay_order_id,
    paymentId: razorpay_payment_id,
    signature: razorpay_signature,
    amount,
    tier,
    plan,
  });
  return success(res, out, 'Order payment verified');
};

export default {
  createOrder,
  webhook,
  subscriptionStatus,
  createSubscriptionIntent,
  verifySubscription,
  verifyOrder,
};
