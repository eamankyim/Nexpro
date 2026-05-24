const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_BYTES = 32;
const PREFIX = 'enc:v1:';

function getKey(envName) {
  const hex = process.env[envName];
  if (!hex || typeof hex !== 'string' || hex.length !== KEY_BYTES * 2) return null;
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    return null;
  }
}

function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptSecret(value, envName) {
  const key = getKey(envName);
  if (!key) return value;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(value || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${Buffer.concat([iv, enc, tag]).toString('base64')}`;
}

function decryptSecret(value, envName) {
  if (!isEncryptedSecret(value)) return value;
  const key = getKey(envName);
  if (!key) {
    throw new Error(`${envName} is required to decrypt this secret`);
  }
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  if (buf.length < IV_LEN + 16) throw new Error('Invalid encrypted secret');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - 16);
  const enc = buf.subarray(IV_LEN, buf.length - 16);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

function hasKey(envName) {
  return getKey(envName) !== null;
}

module.exports = {
  decryptSecret,
  encryptSecret,
  hasKey,
  isEncryptedSecret
};
