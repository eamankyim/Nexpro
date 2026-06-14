require('pg-hstore');

const { Sequelize } = require('sequelize');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || '';
const isNeonDatabase = databaseUrl.includes('neon');
const useNeonWebSocketDriver = isNeonDatabase && process.env.NEON_USE_WEBSOCKET === 'true';

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

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  dialectModule,
  logging: process.env.SQL_DEBUG === 'true' ? console.log : false,
  pool: {
    max: 15,
    min: useNeonWebSocketDriver ? 0 : 3,
    acquire: 60000,
    idle: 10000,
  },
  dialectOptions: usesSsl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : false,
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = { sequelize, testConnection };

