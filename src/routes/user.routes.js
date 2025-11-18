import { Router } from 'express';
import auth from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { profile, update, updateValidators } from '../controllers/user.controller.js';

const router = Router();

router.get('/profile', auth, profile);
router.put('/update-profile', auth, updateValidators, validate, update);

export default router;
