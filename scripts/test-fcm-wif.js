import admin from 'firebase-admin';

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.findIndex((a) => a === `--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
};

const token = getArg('token');
const title = getArg('title') || 'Test notification';
const body = getArg('body') || 'WIF ADC test from EC2';
const dataRaw = getArg('data');
let data = {};
if (dataRaw) {
  try {
    data = JSON.parse(dataRaw);
  } catch (_e) {
    console.error('Invalid JSON for --data');
    process.exit(1);
  }
}

if (!token) {
  console.error('Usage: node scripts/test-fcm-wif.js --token <FCM_DEVICE_TOKEN> [--title "Title"] [--body "Body"] [--data "{\\"k\\":\\"v\\"}"]');
  process.exit(1);
}

let initialized = false;
try {
  admin.app();
  initialized = true;
  console.log('Firebase Admin already initialized');
} catch (_e) {
  // not initialized
}

if (!initialized) {
  // Uses GOOGLE_APPLICATION_CREDENTIALS (external_account JSON) via ADC
  admin.initializeApp();
  console.log('Firebase Admin initialized via ADC');
}

const message = {
  token,
  notification: { title, body },
  data,
};

try {
  const res = await admin.messaging().send(message);
  console.log('FCM sent. Message ID:', res);
  process.exit(0);
} catch (err) {
  console.error('Error sending FCM:', err?.message || err);
  console.error(err);
  process.exit(2);
}
