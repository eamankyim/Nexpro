/**
 * Push DATABASE_URL from Backend/.env to demo API only (nexpro-backend).
 * Production (shopwise_backend) uses its own DB — see restore-production-database-on-vercel.js
 *
 * Usage: node scripts/sync-canonical-database-to-vercel.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawnSync } = require('child_process');
const path = require('path');
const {
  DEMO_CANONICAL_DB_HOST,
  isDemoCanonicalDatabaseUrl,
  getDatabaseHost,
} = require('../config/canonicalDatabase');

const BACKEND_DIR = path.join(__dirname, '..');
const SCOPE = 'unext-globals-projects';
const PROJECTS = ['nexpro-backend'];
/** Production is required; preview/development can fail on some Vercel plans — pass --all-envs to try them. */
const ENVIRONMENTS = process.argv.includes('--all-envs')
  ? ['production', 'preview', 'development']
  : ['production'];
const VARS = ['DATABASE_URL', 'DATABASE_URL_UNPOOLED'];

function run(cmd, args, input) {
  const result = spawnSync(cmd, args, {
    cwd: BACKEND_DIR,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return result;
}

function linkProject(project) {
  const r = run('vercel', ['link', '--yes', '--project', project, '--scope', SCOPE]);
  if (r.status !== 0) {
    throw new Error(`vercel link failed for ${project}: ${r.stderr || r.stdout}`);
  }
}

function setEnv(project, name, environment, value) {
  const r = run('vercel', ['env', 'add', name, environment, '--force', '--scope', SCOPE], value);
  if (r.status !== 0) {
    throw new Error(
      `vercel env add ${name} ${environment} on ${project} failed: ${r.stderr || r.stdout}`
    );
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const unpooled = process.env.DATABASE_URL_UNPOOLED;

  if (!isDemoCanonicalDatabaseUrl(databaseUrl)) {
    const host = getDatabaseHost(databaseUrl);
    console.error(
      `❌ Backend/.env DATABASE_URL host is "${host}", expected demo DB "${DEMO_CANONICAL_DB_HOST}".`
    );
    console.error('   Local .env should use the demo Neon URL, not production.');
    process.exit(1);
  }

  if (!databaseUrl || !unpooled) {
    console.error('❌ DATABASE_URL and DATABASE_URL_UNPOOLED must be set in Backend/.env');
    process.exit(1);
  }

  console.log(`\n🔄 Syncing demo DB (${DEMO_CANONICAL_DB_HOST}) → nexpro-backend only...\n`);

  for (const project of PROJECTS) {
    console.log(`📦 ${project}`);
    linkProject(project);
    for (const env of ENVIRONMENTS) {
      for (const varName of VARS) {
        const value = varName === 'DATABASE_URL' ? databaseUrl : unpooled;
        setEnv(project, varName, env, value);
        console.log(`   ✓ ${varName} → ${env}`);
      }
    }
  }

  console.log('\n✅ Demo API env synced. Redeploy nexpro-backend. Production API is unchanged.\n');
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
