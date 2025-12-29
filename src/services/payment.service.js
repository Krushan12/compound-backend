import dayjs from 'dayjs';
import prisma from '../config/db.js';
import Razorpay from 'razorpay';
import env from '../config/env.js';
import crypto from 'crypto';
import * as SubscriptionService from './subscription.service.js';

export const createOrder = async (userId, amount) => {
  try {
    console.log('🔑 Testing Razorpay Keys for Order:', { 
      keyId: env.RAZORPAY_KEY_ID ? `${env.RAZORPAY_KEY_ID.substring(0, 8)}...` : 'MISSING',
      keySecret: env.RAZORPAY_KEY_SECRET ? `${env.RAZORPAY_KEY_SECRET.substring(0, 8)}...` : 'MISSING'
    });
    
    const instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    const paise = Math.round(Number(amount) * 100);
    
    console.log('📋 Creating Razorpay order:', { userId, amount, paise });
    const order = await instance.orders.create({ amount: paise, currency: 'INR', receipt: `rcpt_${Date.now()}` });
    console.log('✅ Order created successfully:', order.id);

    await prisma.transaction.create({
      data: { userId, amount: paise, provider: 'razorpay', status: 'CREATED', providerOrderId: order.id },
    });

    return { orderId: order.id, amount: paise, currency: order.currency, keyId: env.RAZORPAY_KEY_ID };
  } catch (error) {
    console.error('❌ Razorpay order creation failed:', {
      message: error.message,
      statusCode: error.statusCode,
      error: error.error,
      stack: error.stack
    });
    throw error;
  }
};

// Handle Razorpay webhooks for subscription/invoice/payment events
export const handleRazorpayWebhook = async (payload) => {
  const event = payload?.event;
  try {
    if (event === 'invoice.paid') {
      const invoice = payload?.payload?.invoice?.entity;
      const subscriptionId = invoice?.subscription_id;
      if (!subscriptionId) return;
      // Update transaction status
      const tx = await prisma.transaction.findFirst({ where: { providerOrderId: subscriptionId } });
      if (tx) {
        await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'SUCCESS' } });
        // Activate subscription access for the user (fallback: 30 days)
        const userId = tx.userId;
        const amount = Math.round(Number(invoice?.amount_paid ?? 0));
        // Try to infer plan by interval count from subscription payload if present
        const subEntity = payload?.payload?.subscription?.entity;
        let plan = 'monthly';
        if (subEntity?.interval === 3 && subEntity?.period === 'monthly') plan = 'quarterly';
        if (subEntity?.period === 'yearly') plan = 'yearly';
        await SubscriptionService.createOrUpdateSubscription(userId, { plan, amount: amount / 100 });
      }
    } else if (event === 'subscription.activated') {
      const sub = payload?.payload?.subscription?.entity;
      const subscriptionId = sub?.id;
      const notesUserId = sub?.notes?.userId;
      if (subscriptionId) {
        const tx = await prisma.transaction.findFirst({ where: { providerOrderId: subscriptionId } });
        const userId = notesUserId || tx?.userId;
        if (userId) {
          // Mark as active; duration will be finalized on first invoice.paid
          await prisma.subscription.upsert({
            where: { userId },
            update: { status: 'ACTIVE' },
            create: { userId, status: 'ACTIVE' },
          });
        }
      }
    } else if (event === 'payment.failed') {
      const payment = payload?.payload?.payment?.entity;
      const subscriptionId = payment?.subscription_id;
      if (subscriptionId) {
        const tx = await prisma.transaction.findFirst({ where: { providerOrderId: subscriptionId } });
        if (tx) await prisma.transaction.update({ where: { id: tx.id }, data: { status: 'FAILED' } });
      }
    }
  } catch (e) {
    // swallow to avoid webhook retries flood; rely on logs in real system
  }
};

export const handlePaymentSuccess = async (payload) => {
  const { userId, orderId, amount } = payload;
  await prisma.transaction.updateMany({
    where: { providerOrderId: orderId },
    data: { status: 'SUCCESS' },
  });
  const expiry = dayjs().add(30, 'day').toDate();
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      status: 'ACTIVE',
      expiresAt: expiry,
      startedAt: new Date(),
    },
    create: {
      userId,
      status: 'ACTIVE',
      expiresAt: expiry,
      startedAt: new Date(),
    },
  });
};

export const subscriptionStatus = async (userId) => {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub ? { status: sub.status, expiresAt: sub.expiresAt, tier: sub.tier } : { status: 'INACTIVE' };
};

// Verify signature for one-time order payments and activate subscription for 30 days
export const verifyOrderPayment = async (userId, { orderId, paymentId, signature, amount, tier = 'basic', plan = null }) => {
  const hmac = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET);
  hmac.update(`${orderId}|${paymentId}`);
  const digest = hmac.digest('hex');
  if (digest !== signature) {
    throw new Error('Invalid payment signature');
  }

  await prisma.transaction.updateMany({
    where: { providerOrderId: orderId },
    data: { status: 'SUCCESS' },
  });

  // Compute expiry based on selected one-time plan
  // Supported: threeMonths, sixMonths, nineMonths, yearly (12 months)
  let months = 1;
  switch (plan) {
    case 'threeMonths':
      months = 3; break;
    case 'sixMonths':
      months = 6; break;
    case 'nineMonths':
      months = 9; break;
    case 'yearly':
      months = 12; break;
    default:
      months = 1; // fallback
  }
  const expiry = dayjs().add(months, 'month').toDate();
  await prisma.subscription.upsert({
    where: { userId },
    update: {
      status: 'ACTIVE',
      expiresAt: expiry,
      tier,
      amount: Number(amount),
      plan: plan || undefined,
      startedAt: new Date(),
    },
    create: {
      userId,
      status: 'ACTIVE',
      expiresAt: expiry,
      tier,
      amount: Number(amount),
      plan: plan || undefined,
      startedAt: new Date(),
    },
  });

  return { verified: true };
};

// Create a Razorpay plan (if needed) and a subscription; return subscription_id and keyId for client checkout
export const createSubscription = async (userId, { plan, amount, customer, tier = 'basic' }) => {
  try {
    console.log('🔑 Razorpay Keys:', { 
      keyId: env.RAZORPAY_KEY_ID ? `${env.RAZORPAY_KEY_ID.substring(0, 8)}...` : 'MISSING',
      keySecret: env.RAZORPAY_KEY_SECRET ? `${env.RAZORPAY_KEY_SECRET.substring(0, 8)}...` : 'MISSING'
    });
    
    const instance = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
    const paise = Math.round(Number(amount) * 100);

    console.log('📋 Creating subscription:', { userId, plan, amount, paise });

    // Map plan to Razorpay period/interval and total_count
    let period = 'monthly';
    let interval = 1;
    let total_count = 12;
    switch (plan) {
      case 'monthly':
        period = 'monthly';
        interval = 1;
        total_count = 12;
        break;
      case 'quarterly':
        period = 'monthly';
        interval = 3;
        total_count = 4;
        break;
      case 'yearly':
        period = 'yearly';
        interval = 1;
        total_count = 1;
        break;
      default:
        throw new Error('Invalid plan');
    }

    // For testing, create a plan on the fly
    console.log('🎯 Creating Razorpay plan:', { period, interval, amount: paise });
    const planRes = await instance.plans.create({
      period,
      interval,
      item: { name: `Rainbow ${plan} plan`, amount: paise, currency: 'INR' },
    });
    console.log('✅ Plan created:', planRes.id);

    const notes = { userId, tier };
    console.log('🔄 Creating subscription with plan:', planRes.id);
    const subRes = await instance.subscriptions.create({
      plan_id: planRes.id,
      customer_notify: 1,
      total_count,
      notes,
      // If customer details are present, Razorpay will create a customer object
      ...(customer?.email || customer?.contact
        ? { customer: { name: customer?.name, email: customer?.email, contact: customer?.contact } }
        : {}),
    });
    console.log('✅ Subscription created:', subRes.id);

    // Track intent locally using subscription id in transaction table
    await prisma.transaction.create({
      data: { userId, amount: paise, provider: 'razorpay', status: 'CREATED', providerOrderId: subRes.id },
    });

    return { subscriptionId: subRes.id, keyId: env.RAZORPAY_KEY_ID };
  } catch (error) {
    console.error('❌ Razorpay subscription creation failed:', {
      message: error.message,
      statusCode: error.statusCode,
      error: error.error,
      stack: error.stack
    });
    throw error;
  }
};

// Verify subscription auth payment signature and activate subscription as per selected plan
// Razorpay docs: signature = HMAC_SHA256(razorpay_payment_id + '|' + razorpay_subscription_id, secret)
export const verifySubscriptionPayment = async (userId, { subscriptionId, paymentId, signature, plan, amount }) => {
  const hmac = crypto.createHmac('sha256', env.RAZORPAY_KEY_SECRET);
  hmac.update(`${paymentId}|${subscriptionId}`);
  const digest = hmac.digest('hex');
  if (digest !== signature) {
    throw new Error('Invalid subscription signature');
  }

  await prisma.transaction.updateMany({
    where: { providerOrderId: subscriptionId },
    data: { status: 'SUCCESS' },
  });

  // Activate according to selected plan using SubscriptionService
  await SubscriptionService.createOrUpdateSubscription(userId, { plan, amount });

  return { verified: true };
};

export default {
  createOrder,
  handlePaymentSuccess,
  subscriptionStatus,
  verifyOrderPayment,
  createSubscription,
  verifySubscriptionPayment,
  handleRazorpayWebhook,
};
