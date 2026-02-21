// Explicitly require pg before Sequelize to ensure it's available
require('pg');
require('pg-hstore');

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.SQL_DEBUG === 'true' ? console.log : false,
  pool: {
    max: 15, // Higher concurrency for remote DB
    min: 3, // Keep warm connections to reduce setup latency
    acquire: 60000,
    idle: 10000
  },
  dialectOptions: {
    // Only use SSL for external databases (like Neon, AWS, Render external)
    // Render internal network doesn't need SSL
    ssl: process.env.DATABASE_URL?.includes('neon') || 
         process.env.DATABASE_URL?.includes('amazonaws.com') || 
         (process.env.DATABASE_URL?.includes('render.com') && !process.env.DATABASE_URL?.includes('internal')) ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, testConnection };

