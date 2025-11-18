import { Router } from 'express';
import auth from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createSubscription,
  getSubscription,
  cancelSubscription,
  createSubscriptionValidators,
} from '../controllers/subscription.controller.js';

const router = Router();

router.post('/create', auth, createSubscriptionValidators, validate, createSubscription);
router.get('/me', auth, getSubscription);
router.post('/cancel', auth, cancelSubscription);

export default router;
