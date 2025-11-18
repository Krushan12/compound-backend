import { Router } from 'express';
import auth from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createOrder,
  subscriptionStatus,
  createOrderValidators,
  createSubscriptionIntent,
  verifySubscription,
  createSubscriptionIntentValidators,
  verifySubscriptionValidators,
} from '../controllers/payment.controller.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Razorpay payments and subscriptions
 */

/**
 * @swagger
 * /payment/create-order:
 *   post:
 *     summary: Create a Razorpay Order (one-time payment)
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: integer
 *                 example: 999
 *                 description: Amount in rupees (server converts to paise)
 *     responses:
 *       200:
 *         description: Order created
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/create-order', auth, createOrderValidators, validate, createOrder);

/**
 * @swagger
 * /payment/subscription/status:
 *   get:
 *     summary: Get current user's subscription status
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Subscription status
 *       401:
 *         description: Unauthorized
 */
router.get('/subscription/status', auth, subscriptionStatus);

/**
 * @swagger
 * /payment/subscriptions/intent:
 *   post:
 *     summary: Create a Razorpay Subscription intent (returns subscriptionId and keyId)
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan, amount]
 *             properties:
 *               plan:
 *                 type: string
 *                 enum: [monthly, quarterly, yearly]
 *                 example: monthly
 *               amount:
 *                 type: number
 *                 example: 999
 *     responses:
 *       200:
 *         description: Subscription intent created
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/subscriptions/intent',
  auth,
  createSubscriptionIntentValidators,
  validate,
  createSubscriptionIntent
);

/**
 * @swagger
 * /payment/subscriptions/verify:
 *   post:
 *     summary: Verify subscription payment and activate access
 *     tags: [Payments]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_subscription_id, razorpay_payment_id, razorpay_signature, plan, amount]
 *             properties:
 *               razorpay_subscription_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [monthly, quarterly, yearly]
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Verification successful
 *       401:
 *         description: Unauthorized
 *       400:
 *         description: Invalid signature / payload
 */
router.post(
  '/subscriptions/verify',
  auth,
  verifySubscriptionValidators,
  validate,
  verifySubscription
);

export default router;
