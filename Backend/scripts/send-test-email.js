/**
 * Send a test platform email (uses PLATFORM_EMAIL_PROVIDER + SendGrid/SMTP from .env).
 * Usage: node scripts/send-test-email.js [recipient@email.com]
 */
require('dotenv').config();

const emailService = require('../services/emailService');
const emailTemplates = require('../services/emailTemplates');

const to = process.argv[2] || 'sabitoapp1@gmail.com';
const appName = process.env.APP_NAME || 'African Business Suite';
const subject = `Test email — ${appName}`;
const plainBody = [
  'This is a test email from your platform.',
  '',
  'If you see this in the styled card layout, your provider (SendGrid, SMTP, etc.) is working.',
  '',
  `Time: ${new Date().toISOString()}`
].join('\n');
const html = emailTemplates.marketingPlainMessageEmail(plainBody, { name: appName });
const text = plainBody;

(async () => {
  try {
    console.log('Sending test email to:', to);
    const result = await emailService.sendPlatformMessage(to, subject, html, text);
    if (result.success) {
      console.log('Success! Check the inbox for', to);
    } else {
      console.error('Failed:', result.error);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
