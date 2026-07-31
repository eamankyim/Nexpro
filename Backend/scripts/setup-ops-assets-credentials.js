#!/usr/bin/env node
/**
 * Configure IT Ops vault credentials on a Contabo (or any) Backend .env.
 *
 * Sets:
 *   OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY  (64 hex chars — generated if missing)
 *   OPS_ASSETS_SECRET_EMAIL                (inbox for reveal OTP codes)
 *
 * Usage (from Backend/ on Contabo):
 *   node scripts/setup-ops-assets-credentials.js
 *   node scripts/setup-ops-assets-credentials.js --email eamankyim@gmail.com
 *   node scripts/setup-ops-assets-credentials.js --force   # rotate encryption key (old passwords become undecryptable)
 *   node scripts/setup-ops-assets-credentials.js /path/to/.env
 *
 * Or:
 *   npm run setup:ops-assets-credentials -- --email eamankyim@gmail.com
 *
 * After running: restart the backend (pm2 restart / systemctl restart / etc.).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const KEY_NAME = 'OPS_ASSETS_CREDENTIALS_ENCRYPTION_KEY';
const EMAIL_NAME = 'OPS_ASSETS_SECRET_EMAIL';
const KEY_PATTERN = /^[0-9a-fA-F]{64}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SECRET_EMAIL = 'eamankyim@gmail.com';

function printUsage() {
  console.error(`Usage: node scripts/setup-ops-assets-credentials.js [options] [env-file]

Options:
  --email <addr>   Secret inbox for reveal OTP codes (default: ${DEFAULT_SECRET_EMAIL})
  --force          Replace existing ${KEY_NAME} with a new key
  --help           Show this help

Examples:
  cd ~/nexpro/Backend
  node scripts/setup-ops-assets-credentials.js
  node scripts/setup-ops-assets-credentials.js --email eamankyim@gmail.com
  npm run setup:ops-assets-credentials -- --email eamankyim@gmail.com
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
    content: `${content}${suffix}\n# IT Ops vault (set by setup-ops-assets-credentials.js)\n${line}\n`,
    changed: true,
  };
}

function parseArgs(argv) {
  const args = {
    force: false,
    email: process.env[EMAIL_NAME] || DEFAULT_SECRET_EMAIL,
    envFile: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--force') {
      args.force = true;
    } else if (arg === '--email') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error('--email requires an address');
      }
      args.email = next.trim();
      i += 1;
    } else if (arg.startsWith('--email=')) {
      args.email = arg.slice('--email='.length).trim();
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

  const email = String(args.email || '').trim();
  if (!EMAIL_PATTERN.test(email)) {
    console.error(`Error: ${EMAIL_NAME} must be a valid email (got: ${email || '(empty)'})`);
    process.exit(1);
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
    console.error('Re-run with --force to replace it (saved ops passwords will not decrypt).');
    process.exit(1);
  }

  if (!KEY_PATTERN.test(key)) {
    console.error(`Error: generated ${KEY_NAME} failed validation.`);
    process.exit(1);
  }

  let changed = false;

  const keyUpsert = upsertEnvValue(content, KEY_NAME, key);
  content = keyUpsert.content;
  changed = changed || keyUpsert.changed;

  const emailUpsert = upsertEnvValue(content, EMAIL_NAME, email);
  content = emailUpsert.content;
  changed = changed || emailUpsert.changed;

  if (changed) {
    fs.writeFileSync(envPath, content, { mode: 0o600 });
  }

  console.log('IT Ops credentials configured.');
  console.log(`  Env file:  ${envPath}`);
  console.log(`  ${KEY_NAME}: ${keyAction}`);
  console.log(`  ${EMAIL_NAME}: ${email}`);
  console.log('');
  if (args.force && existingKey) {
    console.log('WARNING: Encryption key was rotated. Previously saved ops passwords cannot be decrypted.');
    console.log('Re-enter passwords on each asset that needs them.');
    console.log('');
  }
  console.log('Next steps on Contabo:');
  console.log('  1. Restart the backend so it loads the new env (e.g. pm2 restart all)');
  console.log('  2. Open Control Panel → IT Ops and confirm you can save/reveal passwords');
}

main();
