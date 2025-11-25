import dotenv from 'dotenv';

dotenv.config();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'changeme',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  // Cashfree Mobile 360 OTP
  CASHFREE_BASE_URL: process.env.CASHFREE_BASE_URL || '',
  CASHFREE_CLIENT_ID: process.env.CASHFREE_CLIENT_ID || '',
  CASHFREE_CLIENT_SECRET: process.env.CASHFREE_CLIENT_SECRET || '',
  CASHFREE_OTP_TEMPLATE_ID: process.env.CASHFREE_OTP_TEMPLATE_ID || '',
  CASHFREE_SENDER_ID: process.env.CASHFREE_SENDER_ID || '',
  CASHFREE_API_VERSION: process.env.CASHFREE_API_VERSION || '2024-12-01',
  CVL_KRA_API_KEY: process.env.CVL_KRA_API_KEY || '',
  CVL_KRA_AES_KEY: process.env.CVL_KRA_AES_KEY || '',
  CVL_KRA_WEBHOOK_SECRET: process.env.CVL_KRA_WEBHOOK_SECRET || '',
  BSEAPIURL: process.env.BSEAPIURL || '',
  CVL_KRA_BASE_URL: process.env.CVL_KRA_BASE_URL || '',
  CVL_KRA_TOKEN_URL: process.env.CVL_KRA_TOKEN_URL || '',
  CVL_KRA_API_PREFIX: process.env.CVL_KRA_API_PREFIX || '',
  CVL_KRA_USERNAME: process.env.CVL_KRA_USERNAME || '',
  CVL_KRA_POSCODE: process.env.CVL_KRA_POSCODE || '',
  CVL_KRA_PASSWORD: process.env.CVL_KRA_PASSWORD || '',
  CVL_KRA_RTA_CODE: process.env.CVL_KRA_RTA_CODE || '',
  // Firebase Admin (for phone auth token verification)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  // Dev-only override to skip Firebase and return a hardcoded JWT
  USE_HARDCODED_JWT: process.env.USE_HARDCODED_JWT || 'false',
  HARDCODED_JWT: process.env.HARDCODED_JWT || '',
};

export default env;
