require('pg-hstore');

const { Sequelize } = require('sequelize');
require('dotenv').config();

const rawDatabaseUrl = process.env.DATABASE_URL || '';
const isNeonDatabase = rawDatabaseUrl.includes('neon');
const useNeonWebSocketDriver = isNeonDatabase && process.env.NEON_USE_WEBSOCKET === 'true';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Neon connection strings sometimes include channel_binding=require, which can hang or fail with node-pg.
 * @param {string} url
 * @returns {string}
 */
const normalizeDatabaseUrl = (url) => {
  if (!url) return url;
  return url
    .replace(/([?&])channel_binding=require(&|$)/g, (_, prefix, suffix) =>
      prefix === '?' && suffix ? '?' : prefix === '?' ? '' : suffix ? '&' : ''
    )
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
};

const databaseUrl = normalizeDatabaseUrl(rawDatabaseUrl);

/** Opt into Neon over WebSockets when TCP :5432 is blocked; otherwise keep the standard pg path. */
let dialectModule = require('pg');
if (useNeonWebSocketDriver) {
  const { neonConfig } = require('@neondatabase/serverless');
  const ws = require('ws');
  neonConfig.webSocketConstructor = ws;
  dialectModule = require('@neondatabase/serverless');
}

const usesSsl =
  isNeonDatabase ||
  databaseUrl.includes('amazonaws.com') ||
  (databaseUrl.includes('render.com') && !databaseUrl.includes('internal'));

const poolAcquireMs = Number.parseInt(process.env.DB_POOL_ACQUIRE_MS || '', 10);
const poolAcquire =
  Number.isFinite(poolAcquireMs) && poolAcquireMs > 0
    ? poolAcquireMs
    : isNeonDatabase && isDevelopment
      ? 120000
      : 60000;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectModule,
  logging: process.env.SQL_DEBUG === 'true' ? console.log : false,
  pool: {
    max: 15,
    // Neon cold starts + remote pooler: avoid pre-opening multiple TCP/WebSocket connections.
    min: isNeonDatabase || useNeonWebSocketDriver ? 0 : 3,
    acquire: poolAcquire,
    idle: 10000,
  },
  dialectOptions: usesSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 15000,
      }
    : false,
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message || error);

    if (error.name === 'SequelizeConnectionAcquireTimeoutError') {
      console.error(
        '\n💡 Pool acquire timed out before a connection became available. Common causes:\n' +
          '   • Neon database is paused — open https://console.neon.tech and resume/wake the project\n' +
          '   • Cold start after idle — retry once; first connect can take 30–90s\n' +
          '   • Wrong or expired DATABASE_URL — copy a fresh pooled URL from Neon (use *pooler* host)\n' +
          '   • Local dev: set NEON_USE_WEBSOCKET=false (TCP pooler is usually more reliable than WebSockets)\n' +
          '   • Remove channel_binding=require from DATABASE_URL if present\n' +
          '   • Optional: DB_POOL_ACQUIRE_MS=180000 for slower networks\n' +
          '   Run: npm run db:check'
      );
    } else if (
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('getaddrinfo')
    ) {
      console.error(
        '\n💡 DNS could not resolve the database host. Check DATABASE_URL and Neon dashboard.'
      );
    }

    throw error;
  }
};

module.exports = { sequelize, testConnection };

