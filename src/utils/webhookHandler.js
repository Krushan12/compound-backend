import crypto from 'crypto';
import env from '../config/env.js';

// Generic webhook signature verifier (e.g., for Razorpay/Cashfree/Karza)
export const verifySignature = (payload, signature, secret) => {
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return computed === signature;
};

export const handleWebhook = async (req, res, handler, secretEnvKey) => {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-webhook-signature'] || req.headers['x-razorpay-signature'];
    const secret = env[secretEnvKey] || '';

    if (secret && signature) {
      const ok = verifySignature(rawBody, signature, secret);
      if (!ok) return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    await handler(req.body);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
};

export default { verifySignature, handleWebhook };
