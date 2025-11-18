import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../utils/logger.js';

export const auth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  
  if (!token) {
    logger.warn('auth.middleware.noToken', { 
      path: req.path, 
      method: req.method,
      hasAuthHeader: !!req.headers.authorization 
    });
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    logger.debug('auth.middleware.success', { userId: payload.id, path: req.path });
    return next();
  } catch (e) {
    logger.warn('auth.middleware.invalidToken', { 
      path: req.path, 
      error: e.message,
      tokenPreview: token.substring(0, 20) + '...'
    });
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

export default auth;
