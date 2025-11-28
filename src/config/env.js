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
  // MSG91 OTP SMS
  MSG91_BASE_URL: process.env.MSG91_BASE_URL || '',
  MSG91_AUTH_KEY: process.env.MSG91_AUTH_KEY || '',
  MSG91_OTP_FLOW_ID: process.env.MSG91_OTP_FLOW_ID || '',
  MSG91_SENDER_ID: process.env.MSG91_SENDER_ID || '',
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
  // Priority chat admin mobiles (comma-separated list of mobile numbers)
  SUPPORT_ADMIN_MOBILES: process.env.SUPPORT_ADMIN_MOBILES || '',
  // Firebase Admin (for phone auth token verification)
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '',
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || '',
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || '',
  // Dev-only override to skip Firebase and return a hardcoded JWT
  USE_HARDCODED_JWT: process.env.USE_HARDCODED_JWT || 'false',
  HARDCODED_JWT: process.env.HARDCODED_JWT || '',
};

export default env;
