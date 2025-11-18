import { Router } from 'express';
import { handleWebhook } from '../utils/webhookHandler.js';
import * as KycService from '../services/kyc.service.js';

const router = Router();

router.post('/kyc', (req, res) => handleWebhook(req, res, KycService.applyWebhook, 'CVL_KRA_WEBHOOK_SECRET'));

export default router;
