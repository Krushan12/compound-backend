import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import auth from '../middlewares/auth.middleware.js';
import {
  emailSignin,
  emailSigninValidators,
  firebaseLogin,
  firebaseLoginValidators,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/firebase-login', firebaseLoginValidators, validate, firebaseLogin);
router.post('/email-signin', auth, emailSigninValidators, validate, emailSignin);

export default router;
