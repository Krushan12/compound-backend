import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import auth from '../middlewares/auth.middleware.js';
import {
  sendOtp,
  sendOtpValidators,
  verifyOtp,
  verifyOtpValidators,
  emailSignin,
  emailSigninValidators,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/send-otp', sendOtpValidators, validate, sendOtp);
router.post('/verify-otp', verifyOtpValidators, validate, verifyOtp);
router.post('/email-signin', auth, emailSigninValidators, validate, emailSignin);

export default router;
