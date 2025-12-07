const { sequelize, testConnection } = require('../config/database');
const { Tenant } = require('../models');
const dayjs = require('dayjs');
require('dotenv').config();

const fixTrialEndDates = async () => {
  try {
    console.log('🔧 Fixing trial end dates for existing tenants...\n');
    
    // Test and establish database connection
    await testConnection();
    
    // Find all trial tenants without trialEndsAt
    const trialTenantsWithoutEndDate = await Tenant.findAll({
      where: {
        plan: 'trial',
        trialEndsAt: null
      }
    });
    
    if (trialTenantsWithoutEndDate.length === 0) {
      console.log('✅ All trial tenants already have end dates set.\n');
      await sequelize.close();
      process.exit(0);
    }
    
    console.log(`Found ${trialTenantsWithoutEndDate.length} trial tenant(s) without end dates.\n`);
    
    // Set trial end date to 1 month from creation date (or now if created recently)
    for (const tenant of trialTenantsWithoutEndDate) {
      const createdAt = dayjs(tenant.createdAt);
      const now = dayjs();
      
      // If tenant was created more than 1 month ago, set end date to 1 month from creation
      // Otherwise, set it to 1 month from now
      const trialEndDate = createdAt.add(1, 'month').isBefore(now)
        ? now.add(1, 'month').toDate()
        : createdAt.add(1, 'month').toDate();
      
      await tenant.update({
        trialEndsAt: trialEndDate
      });
      
      console.log(`✅ Updated ${tenant.name} (${tenant.slug}):`);
      console.log(`   Trial ends: ${dayjs(trialEndDate).format('MMM D, YYYY')}\n`);
    }
    
    console.log('🎉 All trial end dates have been fixed!\n');
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing trial end dates:', error);
    await sequelize.close();
    process.exit(1);
  }
};

fixTrialEndDates();





