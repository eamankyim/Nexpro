/**
 * Point shopwise_backend (api.africanbusinesssuite.com) at the production database.
 * Reads DATABASE_URL from Backend/.env.production (not local .env).
 *
 * Usage: node scripts/restore-production-database-on-vercel.js
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env.production'),
});

const { spawnSync } = require('child_process');
const path = require('path');
const { PRODUCTION_DB_HOST, getDatabaseHost } = require('../config/canonicalDatabase');

const BACKEND_DIR = path.join(__dirname, '..');
const SCOPE = 'unext-globals-projects';
const PROJECT = 'shopwise_backend';

function run(args, input) {
  return spawnSync('vercel', args, {
    cwd: BACKEND_DIR,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const unpooled = process.env.DATABASE_URL_UNPOOLED;

  if (!databaseUrl || !unpooled) {
    console.error('❌ Copy .env.production.example → .env.production with production DATABASE_URL');
    process.exit(1);
  }

  const host = getDatabaseHost(databaseUrl);
  console.log(`\n🔄 Restoring production API (${PROJECT}) → ${host || PRODUCTION_DB_HOST}\n`);

  let r = run(['link', '--yes', '--project', PROJECT, '--scope', SCOPE]);
  if (r.status !== 0) {
    throw new Error(`vercel link failed: ${r.stderr || r.stdout}`);
  }

  for (const [name, value] of [
    ['DATABASE_URL', databaseUrl],
    ['DATABASE_URL_UNPOOLED', unpooled],
  ]) {
    r = run(['env', 'add', name, 'production', '--force', '--scope', SCOPE], value);
    if (r.status !== 0) {
      throw new Error(`vercel env add ${name} failed: ${r.stderr || r.stdout}`);
    }
    console.log(`   ✓ ${name} → production`);
  }

  console.log(
    '\n✅ Production Vercel env updated. Redeploy shopwise_backend.\n' +
      '   VPS: set DATABASE_URL in ~/nexpro/Backend/.env on the server (can match or differ from Vercel).\n'
  );
}

main();
