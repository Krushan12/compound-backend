import logger from '../utils/logger.js';

// Centralized error handler
export const errorHandler = (err, req, res, _next) => {
  logger.error('Error: %s', err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal Server Error' });
};

export default errorHandler;
