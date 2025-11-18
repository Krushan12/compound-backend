import crypto from 'crypto';

// Base64url helpers (no padding)
function toBase64Url(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(b64u) {
  let s = b64u.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return s;
}

function base64UrlEncode(buf) {
  return toBase64Url(Buffer.from(buf).toString('base64'));
}

function base64UrlDecode(str) {
  return Buffer.from(fromBase64Url(str), 'base64');
}

// Normalize AES key input to raw Buffer and derive cipher variant by length
function getKeySpec(aesKey) {
  if (!aesKey) throw new Error('[CVL] AES key is missing');
  const trimmed = aesKey.trim();

  // Match python/decrytion.py: key = base64UrlDecode(aes_key.strip())
  try {
    const keyB = base64UrlDecode(trimmed);
    const algo = keyB.length === 32 ? 'aes-256-cbc' : keyB.length === 24 ? 'aes-192-cbc' : keyB.length === 16 ? 'aes-128-cbc' : null;
    if (algo) return { keyBytes: keyB, algo };
  } catch (_) {}

  // Fallback: standard Base64
  try {
    const keyB = Buffer.from(trimmed, 'base64');
    const algo = keyB.length === 32 ? 'aes-256-cbc' : keyB.length === 24 ? 'aes-192-cbc' : keyB.length === 16 ? 'aes-128-cbc' : null;
    if (algo) return { keyBytes: keyB, algo };
  } catch (_) {}

  // Fallback: hex
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, 'hex');
    const algo = buf.length === 32 ? 'aes-256-cbc' : buf.length === 24 ? 'aes-192-cbc' : buf.length === 16 ? 'aes-128-cbc' : null;
    if (!algo) {
      throw new Error(`[CVL] AES key (hex) must be 16/24/32 bytes, got ${buf.length} bytes (hex length ${trimmed.length}).`);
    }
    return { keyBytes: buf, algo };
  }

  throw new Error('[CVL] Unsupported AES key format or invalid length; expected 16/24/32 bytes.');
}

// Encrypt JSON payload string -> returns "IV:EncryptedText" (both base64url)
export function encryptString(aesKey, data) {
  const iv = crypto.randomBytes(16);
  const { keyBytes, algo } = getKeySpec(aesKey);
  const cipher = crypto.createCipheriv(algo, keyBytes, iv);
  const encBuf = Buffer.concat([cipher.update(data, 'utf-8'), cipher.final()]);
  const ivEncoded = base64UrlEncode(iv);
  const ctEncoded = base64UrlEncode(encBuf);
  return `${ivEncoded}:${ctEncoded}`;
}

// Decrypt if needed
export function decryptString(aesKey, encryptedText, iv) {
  const { keyBytes, algo } = getKeySpec(aesKey);
  const ivBytes = base64UrlDecode(iv);
  const decipher = crypto.createDecipheriv(algo, keyBytes, ivBytes);
  const ctBytes = base64UrlDecode(encryptedText);
  const decBuf = Buffer.concat([decipher.update(ctBytes), decipher.final()]);
  return decBuf.toString('utf-8');
}

export default { encryptString, decryptString };
