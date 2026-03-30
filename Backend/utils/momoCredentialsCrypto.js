const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_BYTES = 32;

/**
 * @returns {Buffer|null} 32-byte key from MOMO_CREDENTIALS_ENCRYPTION_KEY (64 hex chars)
 */
function getEncryptionKey() {
  const hex = process.env.MOMO_CREDENTIALS_ENCRYPTION_KEY;
  if (!hex || typeof hex !== 'string' || hex.length !== KEY_BYTES * 2) {
    return null;
  }
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    return null;
  }
}

function isEncryptionConfigured() {
  return getEncryptionKey() !== null;
}

/**
 * @param {object} obj - Plain object (e.g. { subscriptionKey, apiUser, apiKey })
 * @returns {string} base64(iv + ciphertext + authTag)
 */
function encryptJson(obj) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('MOMO_CREDENTIALS_ENCRYPTION_KEY is not set or invalid (expect 64 hex characters)');
  }
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(obj);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('base64');
}

/**
 * @param {string} payload - from encryptJson
 * @returns {object}
 */
function decryptJson(payload) {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error('MOMO_CREDENTIALS_ENCRYPTION_KEY is not set or invalid');
  }
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LEN + 16) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(IV_LEN, buf.length - 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

/**
 * @param {string} [value]
 * @returns {string}
 */
function maskSecret(value) {
  const s = String(value || '');
  if (s.length <= 4) return s ? '****' : '';
  return `****${s.slice(-4)}`;
}

module.exports = {
  isEncryptionConfigured,
  encryptJson,
  decryptJson,
  maskSecret,
  getEncryptionKey
};
