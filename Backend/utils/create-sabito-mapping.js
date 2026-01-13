/**
 * Utility script to create a Sabito tenant mapping
 * Usage: node utils/create-sabito-mapping.js <sabito-business-id> <nexpro-tenant-id> [business-name]
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { SabitoTenantMapping, Tenant } = require('../models');

const createMapping = async () => {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node utils/create-sabito-mapping.js <sabito-business-id> <nexpro-tenant-id> [business-name]');
    console.error('');
    console.error('Example:');
    console.error('  node utils/create-sabito-mapping.js eb8c70e2-523c-4408-a1be-9657acf3e34d <your-tenant-id> "iCreations Global"');
    process.exit(1);
  }

  const [sabitoBusinessId, nexproTenantId, businessName] = args;

  try {
    console.log('🔗 Creating Sabito tenant mapping...');
    console.log(`   Sabito Business ID: ${sabitoBusinessId}`);
    console.log(`   NEXPro Tenant ID: ${nexproTenantId}`);
    console.log(`   Business Name: ${businessName || 'N/A'}`);

    // Test database connection
    await testConnection();

    // Verify tenant exists
    const tenant = await Tenant.findByPk(nexproTenantId);
    if (!tenant) {
      console.error(`❌ Error: Tenant not found with ID: ${nexproTenantId}`);
      console.error('');
      console.error('To find your tenant ID:');
      console.error('  1. Log into NEXPro');
      console.error('  2. Open browser console (F12)');
      console.error('  3. Run: localStorage.getItem("activeTenantId")');
      process.exit(1);
    }

    console.log(`✅ Found tenant: ${tenant.name}`);

    // Check if mapping already exists
    const existingMapping = await SabitoTenantMapping.findOne({
      where: { sabitoBusinessId }
    });

    if (existingMapping) {
      console.log('⚠️  Mapping already exists. Updating...');
      await existingMapping.update({
        nexproTenantId,
        businessName: businessName || tenant.name
      });
      console.log('✅ Mapping updated successfully');
    } else {
      // Create new mapping
      const mapping = await SabitoTenantMapping.create({
        sabitoBusinessId,
        nexproTenantId,
        businessName: businessName || tenant.name
      });
      console.log('✅ Mapping created successfully');
      console.log(`   Mapping ID: ${mapping.id}`);
    }

    console.log('');
    console.log('🎉 Done! The webhook should now work correctly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating mapping:', error.message);
    if (error.name === 'SequelizeUniqueConstraintError') {
      console.error('   A mapping with this Sabito business ID already exists');
    }
    process.exit(1);
  }
};

createMapping();




