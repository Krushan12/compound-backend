import env from './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { initializeFirebaseAdmin } from './config/firebase-admin.js';
import { startPriceRefreshScheduler } from './services/price-refresh.service.js';

// Log unexpected errors to help debug crashes
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('UNHANDLED PROMISE REJECTION:', {
    reason,
    stack: reason?.stack,
  });
});

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('UNCAUGHT EXCEPTION:', err);
});

const start = async () => {
  try {
    await connectDB();
    
    // Initialize Firebase Admin for push notifications
    initializeFirebaseAdmin();
    
    // Start automatic price refresh scheduler
    startPriceRefreshScheduler();
    
    app.listen(env.PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Server running on port ${env.PORT}`);
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', e);
    process.exit(1);
  }
};

start();
