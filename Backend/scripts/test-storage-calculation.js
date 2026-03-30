const { sequelize, testConnection } = require('../config/database');
const { getStorageUsageSummary, getTenantStorageUsage, getTenantStorageLimit } = require('../utils/storageLimitHelper');
const { Tenant } = require('../models');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

const testStorageCalculation = async () => {
  try {
    console.log('🧪 Testing Storage Calculation...\n');
    
    // Test database connection
    await testConnection();
    
    // Get all tenants
    const tenants = await Tenant.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']]
    });
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found in database.');
      await sequelize.close();
      process.exit(0);
    }
    
    console.log(`✅ Found ${tenants.length} tenant(s) to test\n`);
    console.log('='.repeat(80));
    
    for (const tenant of tenants) {
      console.log(`\n📊 Testing Tenant: ${tenant.name} (${tenant.id})`);
      console.log(`   Plan: ${tenant.plan}`);
      console.log('-'.repeat(80));
      
      try {
        // Test 1: Get storage limit
        console.log('\n1️⃣ Testing getTenantStorageLimit...');
        const limitInfo = await getTenantStorageLimit(tenant.id);
        console.log(`   ✅ Limit: ${limitInfo.limitMB} MB (${limitInfo.limitMB ? (limitInfo.limitMB / 1024).toFixed(1) : 'Unlimited'} GB)`);
        console.log(`   ✅ Plan Name: ${limitInfo.planName}`);
        console.log(`   ✅ Source: ${limitInfo.source}`);
        
        // Test 2: Get storage usage
        console.log('\n2️⃣ Testing getTenantStorageUsage...');
        const usage = await getTenantStorageUsage(tenant.id);
        console.log(`   ✅ Bytes: ${usage.bytes.toLocaleString()}`);
        console.log(`   ✅ Megabytes: ${usage.megabytes} MB`);
        console.log(`   ✅ Gigabytes: ${usage.gigabytes} GB`);
        
        // Check actual directories
        const uploadsDir = path.join(__dirname, '../uploads');
        const directories = [
          `products/${tenant.id}`,
          `expenses/${tenant.id}`,
          `settings/${tenant.id}`,
        ];
        
        console.log('\n3️⃣ Checking actual directories...');
        for (const dir of directories) {
          const dirPath = path.join(uploadsDir, dir);
          try {
            const files = await fs.readdir(dirPath);
            const fileCount = files.filter(f => !f.startsWith('.')).length;
            console.log(`   📁 ${dir}: ${fileCount} file(s)`);
            
            if (fileCount > 0) {
              // Get total size of files in this directory
              let dirSize = 0;
              for (const file of files) {
                if (!file.startsWith('.')) {
                  const filePath = path.join(dirPath, file);
                  const stats = await fs.stat(filePath);
                  dirSize += stats.size;
                }
              }
              console.log(`      Size: ${(dirSize / 1024).toFixed(2)} KB (${(dirSize / (1024 * 1024)).toFixed(4)} MB)`);
            }
          } catch (error) {
            console.log(`   📁 ${dir}: Does not exist`);
          }
        }
        
        // Test 3: Get storage usage summary
        console.log('\n4️⃣ Testing getStorageUsageSummary...');
        const summary = await getStorageUsageSummary(tenant.id);
        console.log(`   ✅ Current Usage: ${summary.currentMB} MB (${summary.currentGB} GB)`);
        console.log(`   ✅ Limit: ${summary.limitMB} MB (${summary.limitGB} GB)`);
        console.log(`   ✅ Remaining: ${summary.remainingMB} MB (${summary.remainingGB} GB)`);
        console.log(`   ✅ Percentage Used: ${summary.percentageUsed}%`);
        console.log(`   ✅ Can Upload More: ${summary.canUploadMore ? 'Yes' : 'No'}`);
        console.log(`   ✅ Is Near Limit: ${summary.isNearLimit ? 'Yes' : 'No'}`);
        console.log(`   ✅ Is At Limit: ${summary.isAtLimit ? 'Yes' : 'No'}`);
        
        // Verification
        console.log('\n5️⃣ Verification:');
        const calculatedPercentage = Math.round((summary.currentMB / summary.limitMB) * 100);
        const calculatedRemaining = summary.limitMB - summary.currentMB;
        console.log(`   ✅ Percentage calculation: ${summary.currentMB} / ${summary.limitMB} * 100 = ${calculatedPercentage}%`);
        console.log(`   ✅ Remaining calculation: ${summary.limitMB} - ${summary.currentMB} = ${calculatedRemaining} MB`);
        
        if (calculatedPercentage === summary.percentageUsed && calculatedRemaining === summary.remainingMB) {
          console.log('   ✅ All calculations match!');
        } else {
          console.log('   ⚠️  Calculation mismatch detected!');
        }
        
      } catch (error) {
        console.error(`   ❌ Error testing tenant ${tenant.name}:`, error.message);
      }
      
      console.log('\n' + '='.repeat(80));
    }
    
    // Test with a non-existent tenant ID to see error handling
    console.log('\n6️⃣ Testing error handling with invalid tenant ID...');
    try {
      await getTenantStorageLimit('00000000-0000-0000-0000-000000000000');
      console.log('   ⚠️  Should have thrown an error');
    } catch (error) {
      console.log(`   ✅ Correctly threw error: ${error.message}`);
    }
    
    await sequelize.close();
    console.log('\n✅ Storage calculation test completed!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    await sequelize.close();
    process.exit(1);
  }
};

testStorageCalculation();
