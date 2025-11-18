// Quick test script to verify Firebase is working
import { initializeFirebaseAdmin, isFirebaseInitialized } from './src/config/firebase-admin.js';
import { notifyNewStock } from './src/services/notification.service.js';

console.log('🧪 Testing Firebase Notifications...\n');

// Initialize Firebase
initializeFirebaseAdmin();

// Check if initialized
console.log('\n📊 Firebase initialized:', isFirebaseInitialized());

if (isFirebaseInitialized()) {
  console.log('\n📤 Sending test notification...');
  
  // Send test notification
  notifyNewStock({
    id: 'test123',
    symbol: 'TESTSTOCK',
    companyName: 'Test Company Ltd',
    status: 'entry',
  }).then(() => {
    console.log('\n✅ Test complete!');
    process.exit(0);
  }).catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
} else {
  console.error('\n❌ Firebase not initialized!');
  console.log('\n💡 Solutions:');
  console.log('1. Run: gcloud auth application-default login');
  console.log('2. Or add Firebase credentials to .env file');
  process.exit(1);
}
