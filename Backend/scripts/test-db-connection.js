require('dotenv').config();
const { Sequelize } = require('sequelize');

const testConnection = async () => {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env file');
    process.exit(1);
  }

  // Mask password in URL for logging
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':***@');
  console.log('🔍 Testing connection to:', maskedUrl);
  
  // Extract hostname for DNS check
  try {
    const urlMatch = dbUrl.match(/@([^:]+):/);
    if (urlMatch) {
      const hostname = urlMatch[1];
      console.log('📍 Hostname:', hostname);
    }
  } catch (e) {
    console.warn('⚠️  Could not parse hostname from DATABASE_URL');
  }

  const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: dbUrl.includes('neon') || dbUrl.includes('amazonaws.com') ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    pool: {
      max: 1,
      min: 0,
      acquire: 10000,
      idle: 5000
    }
  });

  try {
    console.log('🔄 Attempting to connect...');
    await sequelize.authenticate();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const [results] = await sequelize.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('📊 Database time:', results[0].current_time);
    console.log('📊 PostgreSQL version:', results[0].pg_version.split(',')[0]);
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    if (error.message.includes('ENOTFOUND')) {
      console.error('\n💡 This is a DNS resolution error. Possible causes:');
      console.error('   1. The database endpoint has changed or been deleted');
      console.error('   2. The database is paused (Neon databases auto-pause)');
      console.error('   3. Network connectivity issues');
      console.error('\n🔧 Solutions:');
      console.error('   1. Check your Neon dashboard: https://console.neon.tech');
      console.error('   2. Resume the database if it\'s paused');
      console.error('   3. Get a fresh connection string from Neon');
      console.error('   4. Update DATABASE_URL in your .env file');
    }
    
    await sequelize.close();
    process.exit(1);
  }
};

testConnection();
