import { body } from 'express-validator';
import { success } from '../utils/response.js';
import * as AuthService from '../services/auth.service.js';
import logger from '../utils/logger.js';

export const sendOtpValidators = [body('mobile').isString().isLength({ min: 10 })];
export const verifyOtpValidators = [
  body('mobile').isString().isLength({ min: 10 }),
  body('code').isString().isLength({ min: 4 }),
];
export const emailSigninValidators = [body('email').isEmail()];

export const sendOtp = async (req, res) => {
  logger.info('auth.sendOtp.request', { ip: req.ip, mobile: req.body?.mobile ? String(req.body.mobile).slice(-4) : null });
  const out = await AuthService.sendOtp(req.body.mobile);
  logger.info('auth.sendOtp.success', { mobile: req.body?.mobile ? String(req.body.mobile).slice(-4) : null });
  return success(res, out, 'OTP sent');
};

export const verifyOtp = async (req, res) => {
  logger.info('auth.verifyOtp.request', { ip: req.ip, mobile: req.body?.mobile ? String(req.body.mobile).slice(-4) : null });
  const out = await AuthService.verifyOtp(req.body.mobile, req.body.code);
  if (!out) {
    logger.warn('auth.verifyOtp.invalid', { mobile: String(req.body.mobile).slice(-4) });
    return res.status(400).json({ success: false, message: 'Invalid OTP' });
  }
  logger.info('auth.verifyOtp.success', { userId: out.user?.id, mobile: String(req.body.mobile).slice(-4) });
  return success(res, out, 'Login successful');
};

export const emailSignin = async (req, res) => {
  logger.info('auth.emailSignin.request', { ip: req.ip, userId: req.user?.id, hasEmail: !!req.body?.email });
  const out = await AuthService.emailSignin(req.user.id, req.body.email);
  logger.info('auth.emailSignin.success', { userId: req.user?.id });
  return success(res, out, 'Email saved');
};

export default { sendOtp, verifyOtp, emailSignin };
