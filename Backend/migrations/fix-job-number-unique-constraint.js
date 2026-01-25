const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const fixJobNumberUniqueConstraint = async () => {
  try {
    console.log('🔄 Fixing jobNumber unique constraint to be per-tenant...\n');
    
    await testConnection();
    
    // Check if the constraint exists
    const [constraintCheck] = await sequelize.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'jobs' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'jobs_jobNumber_key';
    `);
    
    if (constraintCheck.length > 0) {
      console.log('📋 Removing global unique constraint on jobNumber...');
      await sequelize.query(`
        ALTER TABLE "jobs" 
        DROP CONSTRAINT IF EXISTS "jobs_jobNumber_key";
      `);
      console.log('   ✅ Removed global unique constraint');
    } else {
      console.log('   ℹ️  Global unique constraint not found (may have been removed already)');
    }
    
    // Check if composite unique constraint already exists
    const [compositeCheck] = await sequelize.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'jobs' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'jobs_tenantId_jobNumber_key';
    `);
    
    if (compositeCheck.length === 0) {
      console.log('📋 Adding composite unique constraint on (tenantId, jobNumber)...');
      await sequelize.query(`
        ALTER TABLE "jobs" 
        ADD CONSTRAINT "jobs_tenantId_jobNumber_key" 
        UNIQUE ("tenantId", "jobNumber");
      `);
      console.log('   ✅ Added composite unique constraint');
    } else {
      console.log('   ℹ️  Composite unique constraint already exists');
    }
    
    console.log('\n✅ Job number constraint migration completed successfully!');
    console.log('📊 Job numbers are now unique per tenant, not globally.\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    await sequelize.close();
    process.exit(1);
  }
};

// Run the migration if called directly
if (require.main === module) {
  fixJobNumberUniqueConstraint();
}

module.exports = fixJobNumberUniqueConstraint;
