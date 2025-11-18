import { Router } from 'express';
import { handleWebhook } from '../utils/webhookHandler.js';
import * as PaymentService from '../services/payment.service.js';

const router = Router();

router.post('/payment', (req, res) =>
  handleWebhook(req, res, PaymentService.handleRazorpayWebhook, 'RAZORPAY_WEBHOOK_SECRET')
);

export default router;
