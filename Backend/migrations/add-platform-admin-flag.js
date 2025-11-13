const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const addPlatformAdminFlag = async () => {
  console.log('👑 Adding isPlatformAdmin flag to users table...');
  try {
    await sequelize.query(
      `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false;`
    );
    console.log('✅ isPlatformAdmin column ready.');
  } catch (error) {
    console.error('💥 Failed to add isPlatformAdmin column:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

addPlatformAdminFlag();


