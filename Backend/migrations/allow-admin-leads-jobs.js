const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');

const allowAdminLeadsJobs = async () => {
  let transaction;
  
  try {
    console.log('🚀 Starting admin leads/jobs migration...\n');
    
    await testConnection();
    transaction = await sequelize.transaction();
    
    // Step 1: Make tenantId nullable in leads table
    console.log('📋 Making tenantId nullable in leads table...');
    await sequelize.query(`
      ALTER TABLE leads 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in leads');
    
    // Step 2: Make tenantId nullable in jobs table
    console.log('📋 Making tenantId nullable in jobs table...');
    await sequelize.query(`
      ALTER TABLE jobs 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in jobs');
    
    // Step 3: Make customerId nullable in jobs table
    console.log('📋 Making customerId nullable in jobs table...');
    await sequelize.query(`
      ALTER TABLE jobs 
      ALTER COLUMN "customerId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ customerId is now nullable in jobs');
    
    // Step 3a: Make tenantId nullable in lead_activities table
    console.log('📋 Making tenantId nullable in lead_activities table...');
    await sequelize.query(`
      ALTER TABLE lead_activities 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in lead_activities');
    
    // Step 3b: Make tenantId nullable in job_status_history table
    console.log('📋 Making tenantId nullable in job_status_history table...');
    await sequelize.query(`
      ALTER TABLE job_status_history 
      ALTER COLUMN "tenantId" DROP NOT NULL;
    `, { transaction });
    console.log('   ✅ tenantId is now nullable in job_status_history');
    
    // Step 4: Add adminLeadId field to jobs table
    console.log('📋 Adding adminLeadId field to jobs table...');
    const [adminLeadIdCheck] = await sequelize.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'jobs' 
      AND column_name = 'adminLeadId';
    `, { transaction });
    
    if (adminLeadIdCheck.length === 0) {
      await sequelize.query(`
        ALTER TABLE jobs 
        ADD COLUMN "adminLeadId" UUID REFERENCES leads(id) ON UPDATE CASCADE ON DELETE SET NULL;
      `, { transaction });
      console.log('   ✅ Added adminLeadId column');
    } else {
      console.log('   ℹ️  adminLeadId column already exists');
    }
    
    // Step 5: Update unique constraint on jobs to handle NULL tenantId
    // We need to drop the existing composite constraint and recreate it with a partial index
    console.log('📋 Updating unique constraint on jobs table...');
    
    // Check if composite constraint exists
    const [constraintCheck] = await sequelize.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'jobs' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'jobs_tenantId_jobNumber_key';
    `, { transaction });
    
    if (constraintCheck.length > 0) {
      // Drop the existing constraint
      await sequelize.query(`
        ALTER TABLE jobs 
        DROP CONSTRAINT IF EXISTS "jobs_tenantId_jobNumber_key";
      `, { transaction });
      console.log('   ✅ Dropped existing composite unique constraint');
      
      // Create a partial unique index that only applies when tenantId IS NOT NULL
      // This allows NULL tenantId (admin jobs) to have duplicate jobNumbers
      await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS jobs_tenantId_jobNumber_unique_idx 
        ON jobs("tenantId", "jobNumber") 
        WHERE "tenantId" IS NOT NULL;
      `, { transaction });
      console.log('   ✅ Created partial unique index for tenant jobs');
    } else {
      console.log('   ℹ️  Composite constraint not found, checking for partial index...');
      const [indexCheck] = await sequelize.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'jobs' 
        AND indexname = 'jobs_tenantId_jobNumber_unique_idx';
      `, { transaction });
      
      if (indexCheck.length === 0) {
        await sequelize.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS jobs_tenantId_jobNumber_unique_idx 
          ON jobs("tenantId", "jobNumber") 
          WHERE "tenantId" IS NOT NULL;
        `, { transaction });
        console.log('   ✅ Created partial unique index for tenant jobs');
      } else {
        console.log('   ℹ️  Partial unique index already exists');
      }
    }
    
    // Step 6: Add indexes for admin queries
    console.log('📋 Adding indexes for admin queries...');
    
    // Index for admin leads (where tenantId IS NULL)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_admin_idx 
      ON leads("createdBy") 
      WHERE "tenantId" IS NULL;
    `, { transaction });
    console.log('   ✅ Added leads_admin_idx');
    
    // Index for admin jobs (where tenantId IS NULL)
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_admin_idx 
      ON jobs("assignedTo") 
      WHERE "tenantId" IS NULL;
    `, { transaction });
    console.log('   ✅ Added jobs_admin_idx');
    
    // Index for jobs linked to admin leads
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_admin_lead_idx 
      ON jobs("adminLeadId") 
      WHERE "adminLeadId" IS NOT NULL;
    `, { transaction });
    console.log('   ✅ Added jobs_admin_lead_idx');
    
    // Index for admin jobs by createdBy
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_admin_created_idx 
      ON jobs("createdBy") 
      WHERE "tenantId" IS NULL;
    `, { transaction });
    console.log('   ✅ Added jobs_admin_created_idx');
    
    await transaction.commit();
    console.log('\n✅ Admin leads/jobs migration completed successfully!');
    console.log('📊 Admin leads and jobs can now be created with tenantId = NULL\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
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
  allowAdminLeadsJobs();
}

module.exports = allowAdminLeadsJobs;
