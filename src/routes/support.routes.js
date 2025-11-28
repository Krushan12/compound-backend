import { Router } from 'express';
import auth from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getPublicChatMessages,
  postPublicChatMessage,
  getPublicChatMessagesValidators,
  postPublicChatMessageValidators,
} from '../controllers/support.controller.js';

const router = Router();

router.get('/public-chat/messages', auth, getPublicChatMessagesValidators, validate, getPublicChatMessages);
router.post('/public-chat/messages', auth, postPublicChatMessageValidators, validate, postPublicChatMessage);

export default router;
