import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let initialized = false;
// --- ADD THIS BLOCK ---
// Force-set the WIF credentials path to ensure it is ALWAYS found
import path from 'path';
// Use the absolute path you verified works
process.env.GOOGLE_APPLICATION_CREDENTIALS = "/home/ubuntu/compound-backend/wif-config.json";
console.log(`🔧 Enforced Credentials Path: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
// ----------------------
//

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
    // Initialize with Application Default Credentials (ADC). This supports
    // Workload Identity Federation (external_account JSON via GOOGLE_APPLICATION_CREDENTIALS).
    console.log('🔄 Initializing Firebase Admin using Application Default Credentials (ADC)...');
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      // Explicitly set projectId for Workload Identity Federation in non-GCP environments
      projectId: 'rainbow-money-450af',
    });
    initialized = true;
    const projectId = admin.app().options.projectId;
    console.log(`✅ Firebase Admin initialized with ADC (Project: ${projectId || 'unknown'})`);
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
