import axios from 'axios';
import env from '../config/env.js';
import { encryptString, decryptString } from '../integrations/cvl/cvlEncryption.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE_URL = (env.CVL_KRA_BASE_URL || 'https://api.kracvl.com').replace(/\/$/, '');
const TOKEN_URL = env.CVL_KRA_TOKEN_URL || `${BASE_URL}/int/api/GetToken`;
const PAN_STATUS_URL = `${BASE_URL}/int/api/GetPanStatus`;
const API_KEY = env.CVL_KRA_API_KEY;
const AES_KEY = env.CVL_KRA_AES_KEY;
const USERNAME = env.CVL_KRA_USERNAME;
const POSCODE = env.CVL_KRA_POSCODE;
const PASSWORD = env.CVL_KRA_PASSWORD;

function ensureConfig() {
  const missing = [];
  if (!API_KEY) missing.push('CVL_KRA_API_KEY');
  if (!AES_KEY) missing.push('CVL_KRA_AES_KEY');
  if (!USERNAME) missing.push('CVL_KRA_USERNAME');
  if (!POSCODE) missing.push('CVL_KRA_POSCODE');
  if (!PASSWORD) missing.push('CVL_KRA_PASSWORD');
  if (missing.length) throw new Error(`CVL KRA missing config: ${missing.join(', ')}`);
}

// --- Logging helpers (verbose, similar to Python script output) ---
function logHeader(title) {
  console.log('\n============================================================');
  console.log(title);
  console.log('============================================================\n');
}
function mask(str, keep = 6) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= keep) return s;
  return s.slice(0, keep) + '...';
}
function logEnv() {
  console.log('Environment: PRODUCTION');
  console.log(`Base URL: ${BASE_URL}/int/api`);
  console.log(`Username: ${USERNAME}`);
  console.log(`POS Code: ${POSCODE}`);
  console.log(`API Key: ${mask(API_KEY)}`);
  console.log('');
}
function logKV(title, value) {
  if (typeof value === 'string') console.log(`${title}: ${value}`);
  else console.log(`${title}:`, value);
}

// --- CVL KRA status code mapping ---
function mapAppStatus(appStatus) {
  const code = String(appStatus ?? '').trim();
  if (!code) {
    return { status: 'PENDING', description: 'Not available' };
  }
  const norm = code.padStart(3, '0');
  const last2 = norm.slice(-2); // vendor-agnostic suffix per spec

  // Map by suffix across vendors
  switch (last2) {
    case '00':
      return { status: 'PENDING', description: 'Not checked with respective KRA' };
    case '01':
      return { status: 'PENDING', description: 'Submitted' };
    case '02':
      return { status: 'VERIFIED', description: 'KRA Verified' };
    case '03':
      return { status: 'PENDING', description: 'Hold' };
    case '04':
      return { status: 'FAILED', description: 'Rejected' };
    case '05':
      return { status: 'PENDING', description: 'Not available' };
    case '06':
      return { status: 'FAILED', description: 'Deactivated' };
    case '07':
      return { status: 'VALIDATED', description: 'KRA Validated' };
    case '11':
      return { status: 'PENDING', description: 'Existing KYC Submitted' };
    case '12':
      return { status: 'VERIFIED', description: 'Existing KYC Verified' };
    case '13':
      return { status: 'PENDING', description: 'Existing KYC Hold' };
    case '14':
      return { status: 'FAILED', description: 'Existing KYC Rejected' };
    case '22':
      return { status: 'VERIFIED', description: 'KYC Registered with CVLMF' };
    case '88':
      return { status: 'PENDING', description: 'Not checked with Multiple KRA' };
    case '99':
      // Covers 999 (Invalid PAN No Format)
      return { status: 'FAILED', description: 'Invalid PAN No Format' };
    default:
      return { status: 'PENDING', description: 'Pending' };
  }
}

export async function cvlGetToken() {
  ensureConfig();
  logHeader('CVL KRA API Testing Tool - PRODUCTION');
  logEnv();
  logHeader('STEP 1: Getting Authentication Token');
  const body = JSON.stringify({ username: USERNAME, poscode: POSCODE, password: PASSWORD });
  const encrypted = encryptString(AES_KEY, body);
  logKV('Original Request Data', body);
  logKV('Encrypted Request', encrypted);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'CustomUsrAgnt',
    api_key: API_KEY,
  };
  let res;
  let data;
  try {
    logKV('Calling GetToken API (JSON-string payload) ...', TOKEN_URL);
    res = await axios.post(TOKEN_URL, JSON.stringify(encrypted), { headers });
    data = res.data;
    logKV('Response Status Code', res.status);
    logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
    if (typeof data === 'string') {
      const txt = data.trim().replace(/^(")|(")$/g, '');
      if (txt.startsWith('{') || txt.startsWith('[')) {
        try {
          const obj = JSON.parse(txt);
          if (obj?.success === '0' || obj?.error_code === 'WEBERR-023') {
            logKV('Server indicated invalid format, retrying with RAW encrypted payload ...', TOKEN_URL);
            res = await axios.post(TOKEN_URL, encrypted, { headers });
            data = res.data;
            logKV('Response Status Code', res.status);
            logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
          }
        } catch (_) {}
      }
    } else if (data && (data.success === '0' || data.error_code === 'WEBERR-023')) {
      logKV('Server indicated invalid format, retrying with RAW encrypted payload ...', TOKEN_URL);
      res = await axios.post(TOKEN_URL, encrypted, { headers });
      data = res.data;
      logKV('Response Status Code', res.status);
      logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
    }
  } catch (e) {
    logKV('First attempt failed, retrying with RAW encrypted payload ...', TOKEN_URL);
    res = await axios.post(TOKEN_URL, encrypted, { headers });
    data = res.data;
    logKV('Response Status Code', res.status);
    logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
  }
  if (typeof data === 'string') {
    const text = data.trim().replace(/^("|')|("|')$/g, '');
    // If server already returned JSON, parse and return
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        logKV('Decrypted Response', parsed);
        if (parsed?.token) logKV('✓ Token Generated Successfully (first 32 chars)', mask(parsed.token, 32));
        return parsed;
      } catch (_) { /* fallthrough */ }
    }
    // Attempt decrypt only if it looks like base64url iv:cipher
    const parts = text.split(':');
    if (parts.length === 2 && /^[A-Za-z0-9\-_]+$/.test(parts[0]) && /[A-Za-z0-9\-_]/.test(parts[1])) {
      try {
        const dec = decryptString(AES_KEY, parts[1], parts[0]);
        const parsed = JSON.parse(dec);
        logKV('Decrypted Response', parsed);
        if (parsed?.token) logKV('✓ Token Generated Successfully (first 32 chars)', mask(parsed.token, 32));
        return parsed;
      } catch (_) { /* fallthrough to raw */ }
    }
    // Treat raw text as token (some envs return token directly)
    logKV('Plain token returned', mask(text, 32));
    return { success: '1', token: text };
  }
  return data;
}

export async function cvlGetPanStatus(token, pan) {
  ensureConfig();
  if (!token) throw new Error('Token is required');
  logHeader('STEP 2: Checking PAN Status');
  const body = JSON.stringify({ pan: String(pan || '').toUpperCase(), poscode: POSCODE });
  const encrypted = encryptString(AES_KEY, body);
  logKV('Original Request Data', body);
  logKV('Encrypted Request', encrypted);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    Token: token,
    'User-Agent': 'CustomUsrAgnt',
    api_key: API_KEY,
  };
  let res;
  let data;
  try {
    logKV('Calling GetPanStatus API (JSON-string payload) ...', PAN_STATUS_URL);
    res = await axios.post(PAN_STATUS_URL, JSON.stringify(encrypted), { headers });
    data = res.data;
    logKV('Response Status Code', res.status);
    logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
    if (typeof data === 'string') {
      const txt = data.trim().replace(/^(")|(")$/g, '');
      if (txt.startsWith('{') || txt.startsWith('[')) {
        try {
          const obj = JSON.parse(txt);
          if (obj?.success === '0' || obj?.error_code === 'WEBERR-023') {
            logKV('Server indicated invalid format, retrying with RAW encrypted payload ...', PAN_STATUS_URL);
            res = await axios.post(PAN_STATUS_URL, encrypted, { headers });
            data = res.data;
            logKV('Response Status Code', res.status);
            logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
          }
        } catch (_) {}
      }
    } else if (data && (data.success === '0' || data.error_code === 'WEBERR-023')) {
      logKV('Server indicated invalid format, retrying with RAW encrypted payload ...', PAN_STATUS_URL);
      res = await axios.post(PAN_STATUS_URL, encrypted, { headers });
      data = res.data;
      logKV('Response Status Code', res.status);
      logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
    }
  } catch (e) {
    logKV('First attempt failed, retrying with RAW encrypted payload ...', PAN_STATUS_URL);
    res = await axios.post(PAN_STATUS_URL, encrypted, { headers });
    data = res.data;
    logKV('Response Status Code', res.status);
    logKV('Response Text', typeof data === 'string' ? data : JSON.stringify(data));
  }
  if (typeof data === 'string') {
    const text = data.trim().replace(/^"|"$/g, '');
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        logKV('✓ Response Decrypted Successfully (JSON)', parsed);
        return parsed;
      } catch (_) { /* ignore */ }
    }
    const parts = text.split(':');
    if (parts.length === 2 && /^[A-Za-z0-9\-_]+$/.test(parts[0]) && /[A-Za-z0-9\-_]/.test(parts[1])) {
      try {
        const dec = decryptString(AES_KEY, parts[1], parts[0]);
        const parsed = JSON.parse(dec);
        logKV('✓ Response Decrypted Successfully', parsed);
        return parsed;
      } catch (_) { /* ignore */ }
    }
    return text;
  }
  return data;
}

export async function checkByPan(userId, pan, name) {
  // Dev bypass mode (similar to hardcoded JWT)
  if (env.USE_MOCK_KYC === 'true') {
    console.log('⚠️  Using MOCK KYC mode (dev bypass)');
    const mockResult = {
      success: '1',
      pan: pan.toUpperCase(),
      name: name,
      status: 'VERIFIED',
      message: 'Mock KYC verification successful (dev mode)',
    };
    
    // Still save to database
    await saveKycRecord(userId, pan, name, 'VERIFIED', mockResult);
    return {
      status: 'VERIFIED',
      pan: pan.toUpperCase(),
      name: name,
      message: 'KYC verified successfully (mock mode)',
    };
  }

  // Real CVL KRA integration
  const tokenData = await cvlGetToken();
  const token = (tokenData && tokenData.token) || (typeof tokenData === 'string' ? tokenData : null);
  if (!token) {
    return { success: false, error: 'Failed to acquire token', details: tokenData };
  }
  
  const out = await cvlGetPanStatus(token, pan);
  
  // Parse response
  let parsedResult = out;
  if (out && typeof out.resdtls === 'string') {
    try {
      const details = JSON.parse(out.resdtls);
      parsedResult = {
        ...out,
        resdtls: details,
      };
    } catch (_) {
      parsedResult = out;
    }
  }

  // Determine status from CVL response and APP_STATUS mapping
  const cvlSuccess = parsedResult.success === '1' || parsedResult.success === 1;
  let kycStatus = 'FAILED';
  let statusDescription = undefined;
  let appStatusCode = undefined;
  if (parsedResult.resdtls) {
    try {
      const details = typeof parsedResult.resdtls === 'string'
        ? JSON.parse(parsedResult.resdtls)
        : parsedResult.resdtls;
      const appStatus = details?.APP_PAN_INQ?.APP_STATUS;
      appStatusCode = appStatus;
      const mapped = mapAppStatus(appStatus);
      kycStatus = mapped.status;
      statusDescription = mapped.description;
      console.log(`CVL APP_STATUS: ${appStatus} → ${kycStatus} (${statusDescription})`);
    } catch (e) {
      console.warn('Failed to parse resdtls:', e);
      kycStatus = cvlSuccess ? 'VERIFIED' : 'FAILED';
    }
  }
  
  // Save to database
  await saveKycRecord(userId, pan, name, kycStatus, parsedResult, statusDescription);
  
  return {
    status: kycStatus,
    statusDescription,
    appStatus: appStatusCode,
    pan: pan.toUpperCase(),
    name: name,
    cvlResponse: parsedResult,
    message: cvlSuccess ? 'KYC verified successfully' : 'KYC verification failed',
  };
}

/**
 * Save KYC record to database and update user status
 */
async function saveKycRecord(userId, pan, name, status, cvlResponse, statusDescription) {
  if (!userId) {
    console.warn('No userId provided, skipping database save');
    return;
  }

  try {
    // Find existing KYC record for this user
    const existing = await prisma.kycRecord.findFirst({
      where: { userId },
    });

    let kycRecord;
    if (existing) {
      // Update existing record
      kycRecord = await prisma.kycRecord.update({
        where: { id: existing.id },
        data: {
          pan: pan.toUpperCase(),
          name,
          status,
          statusDescription,
          provider: 'CVL_KRA',
          rawResponse: cvlResponse,
          lastChecked: new Date(),
        },
      });
    } else {
      // Create new record
      kycRecord = await prisma.kycRecord.create({
        data: {
          userId,
          pan: pan.toUpperCase(),
          name,
          status,
          statusDescription,
          provider: 'CVL_KRA',
          rawResponse: cvlResponse,
          lastChecked: new Date(),
        },
      });
    }

    // Update user's KYC status
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: status },
    });

    console.log(`✅ KYC record saved for user ${userId}: ${status}`);
    return kycRecord;
  } catch (error) {
    console.error('Failed to save KYC record:', error);
    throw error;
  }
}

export default { cvlGetToken, cvlGetPanStatus, checkByPan };
