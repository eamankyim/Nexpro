const { sequelize } = require('../config/database');

async function checkAllJobs() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Check total jobs count
    const [totalCount] = await sequelize.query(
      `SELECT COUNT(*) as count FROM "jobs"`,
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log(`\nTotal jobs in database: ${totalCount.count}`);

    // Get all jobs with their tenant IDs
    const allJobs = await sequelize.query(
      `SELECT "id", "jobNumber", "title", "status", "tenantId", "createdAt" 
       FROM "jobs" 
       ORDER BY "createdAt" DESC 
       LIMIT 20`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log(`\nRecent jobs (last 20):`);
    console.log('='.repeat(100));
    
    if (allJobs.length === 0) {
      console.log('No jobs found in entire database.');
    } else {
      allJobs.forEach((job, index) => {
        console.log(`\n${index + 1}. Job Number: ${job.jobNumber}`);
        console.log(`   Title: ${job.title || 'N/A'}`);
        console.log(`   Status: ${job.status || 'N/A'}`);
        console.log(`   Tenant ID: ${job.tenantId}`);
        console.log(`   Created: ${job.createdAt}`);
        console.log(`   ID: ${job.id}`);
      });
    }

    // Check specifically for JOB-202601-0001
    const specificJob = await sequelize.query(
      `SELECT "id", "jobNumber", "title", "tenantId", "createdAt" 
       FROM "jobs" 
       WHERE "jobNumber" = 'JOB-202601-0001'`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log(`\n\nJobs with number JOB-202601-0001: ${specificJob.length}`);
    if (specificJob.length > 0) {
      specificJob.forEach((job, index) => {
        console.log(`\n${index + 1}. Job Number: ${job.jobNumber}`);
        console.log(`   Tenant ID: ${job.tenantId}`);
        console.log(`   Title: ${job.title || 'N/A'}`);
        console.log(`   Created: ${job.createdAt}`);
        console.log(`   ID: ${job.id}`);
      });
    }

    // Check all tenants
    const tenants = await sequelize.query(
      `SELECT DISTINCT "tenantId", COUNT(*) as job_count 
       FROM "jobs" 
       GROUP BY "tenantId"`,
      { type: sequelize.QueryTypes.SELECT }
    );

    console.log(`\n\nJobs per tenant:`);
    tenants.forEach((tenant) => {
      console.log(`  Tenant ${tenant.tenantId}: ${tenant.job_count} jobs`);
    });

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAllJobs();
