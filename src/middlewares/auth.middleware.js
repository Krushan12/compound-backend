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

// Optional auth: attach req.user if a valid token is present, otherwise continue as guest
export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    logger.debug('auth.middleware.optional.noToken', {
      path: req.path,
      method: req.method,
    });
    return next();
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.user = payload;
    logger.debug('auth.middleware.optional.success', { userId: payload.id, path: req.path });
  } catch (e) {
    logger.warn('auth.middleware.optional.invalidToken', {
      path: req.path,
      error: e.message,
    });
    // Ignore invalid token and continue as guest
  }

  return next();
};

export default auth;
