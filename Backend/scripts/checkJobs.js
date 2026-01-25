const { sequelize } = require('../config/database');
const { Job } = require('../models');

const tenantId = '829eb39a-3132-4621-9aa6-a114481b451d';

async function checkJobs() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established.');

    // Query all jobs for the tenant
    const jobs = await sequelize.query(
      `SELECT "id", "jobNumber", "title", "status", "customerId", "createdAt" 
       FROM "jobs" 
       WHERE "tenantId" = :tenantId 
       ORDER BY "createdAt" DESC`,
      {
        replacements: { tenantId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log(`\nFound ${jobs.length} jobs for tenant ${tenantId}:`);
    console.log('='.repeat(80));
    
    if (jobs.length === 0) {
      console.log('No jobs found in database.');
    } else {
      jobs.forEach((job, index) => {
        console.log(`\n${index + 1}. Job Number: ${job.jobNumber}`);
        console.log(`   Title: ${job.title || 'N/A'}`);
        console.log(`   Status: ${job.status || 'N/A'}`);
        console.log(`   Created: ${job.createdAt}`);
        console.log(`   ID: ${job.id}`);
      });
    }

    // Also check job numbers specifically for January 2026
    const janJobs = await sequelize.query(
      `SELECT "jobNumber" 
       FROM "jobs" 
       WHERE "tenantId" = :tenantId 
       AND "jobNumber" LIKE 'JOB-202601-%'
       ORDER BY "jobNumber" DESC`,
      {
        replacements: { tenantId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    console.log(`\n\nJobs with pattern JOB-202601-*: ${janJobs.length}`);
    if (janJobs.length > 0) {
      janJobs.forEach((job, index) => {
        console.log(`  ${index + 1}. ${job.jobNumber}`);
      });
    }

    await sequelize.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkJobs();
