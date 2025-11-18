import axios from 'axios';
import { env } from '../../config/env.js';
import { encryptString, decryptString } from './cvlEncryption.js';

// CVL base URL and API key from env
const CVL_BASE_URL = env.CVL_KRA_BASE_URL || 'https://api.kracvl.com';
const TOKEN_URL = env.CVL_KRA_TOKEN_URL || `${CVL_BASE_URL}/int/api/GetToken`;
const API_KEY = env.CVL_KRA_API_KEY;
const AES_KEY = env.CVL_KRA_AES_KEY; // base64url encoded key as per CVL docs
const DEFAULT_USERNAME = env.CVL_KRA_USERNAME;
const DEFAULT_POSCODE = env.CVL_KRA_POSCODE;
const DEFAULT_PASSWORD = env.CVL_KRA_PASSWORD;

if (!API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[CVL] CVL_KRA_API_KEY is not set');
}
if (!AES_KEY) {
  // eslint-disable-next-line no-console
  console.warn('[CVL] CVL_KRA_AES_KEY is not set');
}

/**
 * Calls CVL /int/api/GetToken
 * credentials: { username: string, poscode: string, password: string }
 * Returns axios response.data
 */
export async function getToken(credentials = {}) {
  const body = JSON.stringify({
    username: credentials.username || DEFAULT_USERNAME,
    poscode: credentials.poscode || DEFAULT_POSCODE,
    password: credentials.password || DEFAULT_PASSWORD,
  });
  const encrypted = encryptString(AES_KEY, body); // "IV:Cipher"
  const url = TOKEN_URL;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'CustomUsrAgnt',
    api_key: API_KEY,
  };

  // Send as JSON string, matching Python implementation
  const response = await axios.post(url, JSON.stringify(encrypted), { headers });
  const data = response.data;
  if (typeof data === 'string') {
    // Decrypt "iv:cipher" and parse JSON
    const parts = data.replace(/^"|"$/g, '').split(':');
    if (parts.length === 2) {
      const [iv, enc] = parts;
      const decrypted = decryptString(AES_KEY, enc, iv);
      return JSON.parse(decrypted);
    }
  }
  return data;
}

export async function getPanStatus(token, pan) {
  const body = JSON.stringify({
    pan: String(pan || '').toUpperCase(),
    poscode: DEFAULT_POSCODE,
  });
  const encrypted = encryptString(AES_KEY, body);
  const url = `${CVL_BASE_URL}/int/api/GetPanStatus`;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'CustomUsrAgnt',
    Token: token,
  };

  const response = await axios.post(url, JSON.stringify(encrypted), { headers });
  const data = response.data;
  if (typeof data === 'string') {
    const parts = data.replace(/^"|"$/g, '').split(':');
    if (parts.length === 2) {
      const [iv, enc] = parts;
      const decrypted = decryptString(AES_KEY, enc, iv);
      return JSON.parse(decrypted);
    }
  }
  return data;
}

export default { getToken, getPanStatus };
