import admin from 'firebase-admin';
import env from './env.js';

let app;

function initFirebase() {
  if (app) return app;
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;

  // 1) Prefer env-based credential when available (CI/explicit config)
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    const privateKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
    return admin;
  }

  // 2) Fallback to Application Default Credentials (ADC)
  // Works with: gcloud auth application-default login (local)
  // and Workload Identity Federation (EC2) via GOOGLE_APPLICATION_CREDENTIALS external_account JSON
  
  // ADC requires projectId to be set explicitly or via GOOGLE_CLOUD_PROJECT env var
  const projectId = FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'rainbow-money-450af';
  
  app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: projectId,
  });
  
  console.log(`✅ Firebase Admin initialized with ADC (Project: ${projectId})`);
  return admin;
}

const firebaseAdmin = initFirebase();
export default firebaseAdmin;
