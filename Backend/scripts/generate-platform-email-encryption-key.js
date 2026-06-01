const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex');

console.log(key);
console.error('');
console.error('Set this as PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY in your backend environment.');
console.error('Keep it stable across deploys; changing it prevents decrypting saved platform email credentials.');
