/**
 * Set payment collection as configured for a tenant (for localhost/testing).
 * This makes POS show as ready instead of "Set up payment collection".
 * Usage: node scripts/set-payment-collection-configured.js [tenantName]
 * Example: node scripts/set-payment-collection-configured.js "Bosomtwe Cold Store"
 */
require('dotenv').config();

const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { Tenant } = require('../models');

const searchName = process.argv[2] || 'Bosomtwe Cold Store';

const run = async () => {
  try {
    await testConnection();
    const tenant = await Tenant.findOne({
      where: { name: { [Op.iLike]: `%${searchName}%` } }
    });
    if (!tenant) {
      console.error('Tenant not found matching:', searchName);
      process.exit(1);
    }
    const metadata = tenant.metadata || {};
    const pc = metadata.paymentCollection || {};
    metadata.paymentCollection = {
      ...pc,
      settlementType: 'momo',
      momoPhone: pc.momoPhone || '0240000000',
      momoProvider: pc.momoProvider || 'MTN',
      business_name: pc.business_name || tenant.name
    };
    tenant.metadata = metadata;
    await tenant.save();
    console.log('Payment collection set to configured for tenant:', tenant.name, '(id:', tenant.id, ')');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

run();
