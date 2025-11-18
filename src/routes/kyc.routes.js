import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import auth from '../middlewares/auth.middleware.js';
import { checkByPan, panCheckValidators } from '../controllers/kyc.controller.js';

const router = Router();

router.post('/pan-check', auth, panCheckValidators, validate, checkByPan);

export default router;
