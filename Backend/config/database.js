const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 60000, // Increased timeout for connection acquisition
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

