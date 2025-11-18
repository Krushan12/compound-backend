import { body } from 'express-validator';
import { success } from '../utils/response.js';
import { checkByPan as svcCheckByPan } from '../services/kyc.service.js';
import logger from '../utils/logger.js';

export const panCheckValidators = [
  body('pan').isString().isLength({ min: 10, max: 10 }).withMessage('PAN must be 10 characters'),
  body('name').isString().isLength({ min: 2 }).withMessage('Name is required'),
];

export const checkByPan = async (req, res) => {
  const { pan, name } = req.body;
  const userId = req.user?.id;
  
  logger.info('kyc.checkByPan.request', { 
    userId, 
    panMasked: pan ? pan.slice(0, 3) + '***' + pan.slice(-2) : null,
    hasName: !!name 
  });
  
  try {
    const out = await svcCheckByPan(userId, pan, name);
    logger.info('kyc.checkByPan.success', { userId, status: out.status });
    return success(res, out, 'KYC verification completed');
  } catch (error) {
    logger.error('kyc.checkByPan.error', { userId, message: error.message });
    throw error;
  }
};

export default { checkByPan };
