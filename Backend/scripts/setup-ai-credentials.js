#!/usr/bin/env node
/**
 * Configure tenant AI key storage on a Contabo (or any) Backend .env.
 *
 * Sets:
 *   AI_CREDENTIALS_ENCRYPTION_KEY  (64 hex chars — generated if missing)
 *
 * Workspace Settings > AI encrypts tenant Anthropic API keys with this key
 * (AES-256-GCM via utils/secretCrypto.js). Without it, the API returns 503
 * "AI key storage is not configured on this server."
 *
 * Usage (from Backend/ on the server):
 *   node scripts/setup-ai-credentials.js
 *   node scripts/setup-ai-credentials.js --force   # rotate key (saved tenant AI keys become undecryptable)
 *   node scripts/setup-ai-credentials.js /path/to/.env
 *
 * Or:
 *   npm run setup:ai-credentials
 *
 * After running: restart the backend (pm2 restart / systemctl restart / etc.).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_NAME = 'AI_CREDENTIALS_ENCRYPTION_KEY';
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function printUsage() {
  console.error(`Usage: node scripts/setup-ai-credentials.js [options] [env-file]

Options:
  --force          Replace existing ${KEY_NAME} with a new key
  --help           Show this help

Examples:
  cd ~/nexpro/Backend
  node scripts/setup-ai-credentials.js
  node scripts/setup-ai-credentials.js --force
  npm run setup:ai-credentials
`);
}

function resolveEnvPath(envFileArg) {
  if (!envFileArg) {
    return path.resolve(__dirname, '..', '.env');
  }
  return path.isAbsolute(envFileArg)
    ? envFileArg
    : path.resolve(process.cwd(), envFileArg);
}

/**
 * Read an env assignment value (supports optional quotes).
 * @param {string} content
 * @param {string} name
 * @returns {string|null}
 */
function readEnvValue(content, name) {
  const re = new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`, 'm');
  const match = content.match(re);
  if (!match) return null;
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value.trim() || null;
}

/**
 * Upsert KEY=value in env content (uncomments existing KEY lines).
 * @param {string} content
 * @param {string} name
 * @param {string} value
 * @returns {{ content: string, changed: boolean }}
 */
function upsertEnvValue(content, name, value) {
  const line = `${name}="${value}"`;
  const keyLinePattern = new RegExp(`^#?\\s*${name}\\s*=.*$`, 'm');
  if (keyLinePattern.test(content)) {
    const next = content.replace(keyLinePattern, line);
    return { content: next, changed: next !== content };
  }
  const suffix = content.endsWith('\n') ? '' : '\n';
  return {
    content: `${content}${suffix}\n# Tenant AI key storage (set by setup-ai-credentials.js)\n${line}\n`,
    changed: true,
  };
}

function parseArgs(argv) {
  const args = {
    force: false,
    envFile: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (!arg.startsWith('-') && !args.envFile) {
      args.envFile = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    printUsage();
    process.exit(1);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const envPath = resolveEnvPath(args.envFile || process.env.BACKEND_ENV_FILE);
  if (!fs.existsSync(envPath)) {
    console.error(`Error: env file not found: ${envPath}`);
    console.error('Create Backend/.env first, or pass the path as an argument.');
    process.exit(1);
  }

  let content = fs.readFileSync(envPath, 'utf8');
  const existingKey = readEnvValue(content, KEY_NAME);
  let key;
  let keyAction;

  if (existingKey && KEY_PATTERN.test(existingKey) && !args.force) {
    key = existingKey;
    keyAction = 'kept existing';
  } else if (args.force || !existingKey) {
    key = crypto.randomBytes(32).toString('hex');
    keyAction = existingKey ? 'rotated (forced)' : 'generated new';
  } else {
    console.error(`Error: existing ${KEY_NAME} is invalid (must be 64 hex chars).`);
    console.error('Re-run with --force to replace it (saved workspace AI keys will not decrypt).');
    process.exit(1);
  }

  if (!KEY_PATTERN.test(key)) {
    console.error(`Error: generated ${KEY_NAME} failed validation.`);
    process.exit(1);
  }

  const keyUpsert = upsertEnvValue(content, KEY_NAME, key);
  content = keyUpsert.content;
  const changed = keyUpsert.changed;

  if (changed) {
    fs.writeFileSync(envPath, content, { mode: 0o600 });
  }

  console.log('AI key storage configured.');
  console.log(`  Env file:  ${envPath}`);
  console.log(`  ${KEY_NAME}: ${keyAction}`);
  console.log('');
  if (!changed && keyAction === 'kept existing') {
    console.log('No changes written — key was already valid.');
    console.log('If the UI still shows "AI key storage unavailable", restart the backend');
    console.log('so it reloads this env file.');
    console.log('');
  }
  if (args.force && existingKey) {
    console.log('WARNING: Encryption key was rotated. Previously saved workspace AI keys cannot be decrypted.');
    console.log('Tenants must re-enter their Anthropic API keys in Settings → AI.');
    console.log('');
  }
  console.log('Required env (Backend/.env on the server):');
  console.log(`  ${KEY_NAME}=<64 hex chars>`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Restart the backend so it loads the new env (e.g. pm2 restart all)');
  console.log('  2. Open Workspace Settings → AI and confirm "AI key storage unavailable" is gone');
  console.log('  3. Save a workspace Anthropic API key (optional; system ANTHROPIC_API_KEY still works as fallback)');
  console.log('');
  console.log('Do not commit .env. Keep this key stable across deploys.');
}

main();
