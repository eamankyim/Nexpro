const fs = require('fs');
const path = require('path');

const KEY_NAME = 'PLATFORM_EMAIL_CREDENTIALS_ENCRYPTION_KEY';
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function printUsage() {
  console.error(`Usage: node scripts/update-platform-email-encryption-key.js <64-hex-key> [env-file]`);
  console.error('');
  console.error('Examples:');
  console.error(`  node scripts/update-platform-email-encryption-key.js "$(openssl rand -hex 32)" .env`);
  console.error(`  ${KEY_NAME}="$(openssl rand -hex 32)" node scripts/update-platform-email-encryption-key.js`);
}

function resolveEnvPath(envFileArg) {
  if (!envFileArg) {
    return path.resolve(__dirname, '..', '.env');
  }

  return path.isAbsolute(envFileArg)
    ? envFileArg
    : path.resolve(process.cwd(), envFileArg);
}

const [keyArg, envFileArg] = process.argv.slice(2);
const key = (keyArg || process.env[KEY_NAME] || '').trim();
const envPath = resolveEnvPath(envFileArg || process.env.BACKEND_ENV_FILE);

if (!KEY_PATTERN.test(key)) {
  console.error(`Error: ${KEY_NAME} must be exactly 64 hex characters (0-9, a-f).`);
  printUsage();
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error(`Error: env file not found: ${envPath}`);
  console.error('Pass the backend env file path as the second argument.');
  process.exit(1);
}

const original = fs.readFileSync(envPath, 'utf8');
const line = `${KEY_NAME}=${key}`;
const keyLinePattern = new RegExp(`^#?\\s*${KEY_NAME}=.*$`, 'm');
const next = keyLinePattern.test(original)
  ? original.replace(keyLinePattern, line)
  : `${original}${original.endsWith('\n') ? '' : '\n'}${line}\n`;

if (next === original) {
  console.log(`${KEY_NAME} is already set in ${envPath}`);
} else {
  fs.writeFileSync(envPath, next);
  console.log(`Updated ${KEY_NAME} in ${envPath}`);
}
