import admin from 'firebase-admin';
import env from './env.js';

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebaseAdmin = () => {
  // Check if admin app already exists (from previous initialization or hot reload)
  try {
    const app = admin.app();
    console.log(`✅ Firebase Admin already initialized (Project: ${app.options.projectId || 'unknown'})`);
    initialized = true;
    return;
  } catch (e) {
    // App doesn't exist, continue with initialization
    console.log('🔄 Initializing Firebase Admin for the first time...');
  }

  if (initialized) {
    console.log('⚠️ Firebase Admin already initialized');
    return;
  }

  try {
    // Try explicit credentials first (for production)
    if (env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      initialized = true;
      console.log('✅ Firebase Admin initialized with service account');
    } else {
      // Fall back to ADC (Application Default Credentials)
      // This works if you're logged in with: gcloud auth application-default login
      console.log('🔄 Attempting to initialize Firebase with ADC...');
      admin.initializeApp();
      initialized = true;
      const projectId = admin.app().options.projectId;
      console.log(`✅ Firebase Admin initialized with ADC (Project: ${projectId})`);
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
    console.error('❌ Full error:', error);
    console.log('💡 Tip: Run "gcloud auth application-default login" or add Firebase credentials to .env');
    initialized = false;
  }
};

/**
 * Get Firebase Messaging instance
 */
export const getMessaging = () => {
  if (!initialized) {
    throw new Error('Firebase Admin not initialized');
  }
  return admin.messaging();
};

/**
 * Check if Firebase is initialized
 */
export const isFirebaseInitialized = () => initialized;

export default admin;
