/**
 * Create or update superadmin account
 * Usage: node scripts/create-superadmin.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize, testConnection } = require('../config/database');
const { User, Tenant, UserTenant } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

const SUPERADMIN_EMAIL = 'superadmin@gmail.com';
const SUPERADMIN_PASSWORD = '111111@1A';
const SUPERADMIN_NAME = 'Super Admin';

const createSuperadmin = async () => {
  try {
    console.log('👑 Creating superadmin account...\n');
    await testConnection();

    const transaction = await sequelize.transaction();

    try {
      let superadmin = await User.findOne({
        where: { email: SUPERADMIN_EMAIL },
        transaction,
      });

      if (superadmin) {
        superadmin.password = SUPERADMIN_PASSWORD;
        superadmin.name = SUPERADMIN_NAME;
        superadmin.role = 'admin';
        superadmin.isActive = true;
        superadmin.isPlatformAdmin = true;
        superadmin.isFirstLogin = false;
        await superadmin.save({ transaction });
        console.log('♻️  Updated existing superadmin account.');
      } else {
        const existingPlatformAdmin = await User.findOne({
          where: { isPlatformAdmin: true },
          transaction,
        });

        if (existingPlatformAdmin) {
          existingPlatformAdmin.email = SUPERADMIN_EMAIL;
          existingPlatformAdmin.password = SUPERADMIN_PASSWORD;
          existingPlatformAdmin.name = SUPERADMIN_NAME;
          existingPlatformAdmin.role = 'admin';
          existingPlatformAdmin.isActive = true;
          existingPlatformAdmin.isPlatformAdmin = true;
          existingPlatformAdmin.isFirstLogin = false;
          await existingPlatformAdmin.save({ transaction });
          superadmin = existingPlatformAdmin;
          console.log('♻️  Updated platform admin to new credentials.');
        } else {
          superadmin = await User.create(
            {
              name: SUPERADMIN_NAME,
              email: SUPERADMIN_EMAIL,
              password: SUPERADMIN_PASSWORD,
              role: 'admin',
              isActive: true,
              isPlatformAdmin: true,
              isFirstLogin: false,
            },
            { transaction }
          );
          console.log('✅ Superadmin user created successfully!');
        }
      }

      const [defaultTenant] = await Tenant.findOrCreate({
        where: { slug: 'default' },
        defaults: {
          name: 'Default Tenant',
          plan: 'trial',
          status: 'active',
          metadata: {},
          trialEndsAt: dayjs().add(1, 'month').toDate(),
        },
        transaction,
      });

      const existingMembership = await UserTenant.findOne({
        where: {
          userId: superadmin.id,
          tenantId: defaultTenant.id,
        },
        transaction,
      });

      if (!existingMembership) {
        await UserTenant.create(
          {
            userId: superadmin.id,
            tenantId: defaultTenant.id,
            role: 'owner',
            status: 'active',
            isDefault: true,
            joinedAt: new Date(),
          },
          { transaction }
        );
        console.log('✅ Linked superadmin to default tenant.');
      }

      await transaction.commit();

      console.log('\n📧 Superadmin Credentials:');
      console.log(`   Email: ${SUPERADMIN_EMAIL}`);
      console.log(`   Password: ${SUPERADMIN_PASSWORD}`);
      console.log(`   Role: Platform Admin (Superadmin)`);
      console.log('\n🎉 Done!\n');

      await sequelize.close();
      process.exit(0);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
};

createSuperadmin();
