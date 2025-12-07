const { sequelize, testConnection } = require('../config/database');
const { User, Tenant, UserTenant } = require('../models');
const dayjs = require('dayjs');
require('dotenv').config();

// Generate unique slug for tenant
const generateUniqueSlug = async (baseName, transaction = null) => {
  const base = baseName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  
  let slug = base;
  let counter = 1;
  
  while (true) {
    const existing = await Tenant.findOne({ 
      where: { slug },
      transaction 
    });
    if (!existing) {
      return slug;
    }
    slug = `${base}-${counter++}`;
  }
};

/**
 * Seed tenant admin user (NOT platform admin)
 * This creates a regular admin user for a specific tenant
 * Platform admin should be created separately using seedPlatformAdmin.js
 */
const seedAdmin = async () => {
  try {
    console.log('🌱 Starting tenant admin user seed...\n');
    
    // Test and establish database connection
    await testConnection();
    
    const transaction = await sequelize.transaction();
    
    try {
      const targetEmail = 'eamankyim@gmail.com';
      
      // First check if user with this email exists (any status)
      const existingUser = await User.findOne({ 
        where: { email: targetEmail },
        transaction 
      });
      
      let admin;
      let tenant;
      
      if (existingUser) {
        // User exists - check if it's a platform admin
        if (existingUser.isPlatformAdmin) {
          console.log('⚠️  User with email', targetEmail, 'already exists as Platform Admin.');
          console.log('   Skipping tenant admin creation. Platform admin should use superadmin@nexpro.com');
          console.log('   If you want to create a tenant admin, use a different email address.');
          await transaction.commit();
          await sequelize.close();
          process.exit(0);
        }
        
        // User exists and is NOT a platform admin - update it
        existingUser.name = 'Eric Amankyim';
        existingUser.role = 'admin';
        existingUser.isPlatformAdmin = false; // Explicitly set to false
        existingUser.isActive = true;
        existingUser.isFirstLogin = false;
        existingUser.password = '199855@EricAdmin';
        await existingUser.save({ transaction });
        admin = existingUser;
        
        console.log('♻️ Admin user already existed and was updated.');
        
        // Check if admin has a tenant
        const membership = await UserTenant.findOne({
          where: { userId: admin.id, isDefault: true },
          include: [{ model: Tenant, as: 'tenant' }],
          transaction
        });
        
        if (membership && membership.tenant) {
          tenant = membership.tenant;
          console.log('✅ Admin is already linked to tenant:', tenant.name);
        } else {
          // Create tenant for existing admin
          const slug = await generateUniqueSlug('Eric Amankyim Company', transaction);
          const trialEndDate = dayjs().add(1, 'month').toDate();
          
          tenant = await Tenant.create({
            name: 'Eric Amankyim Company',
            slug,
            plan: 'trial',
            status: 'active',
            metadata: {},
            trialEndsAt: trialEndDate
          }, { transaction });
          
          // Link admin to tenant
          await UserTenant.create({
            userId: admin.id,
            tenantId: tenant.id,
            role: 'owner',
            status: 'active',
            isDefault: true,
            joinedAt: new Date()
          }, { transaction });
          
          console.log('✅ Created tenant and linked to admin:', tenant.name);
        }
      } else {
        // User doesn't exist - create new tenant admin user (NOT platform admin)
        admin = await User.create({
          name: 'Eric Amankyim',
          email: targetEmail,
          password: '199855@EricAdmin', // Will be hashed by the model
          role: 'admin',
          isPlatformAdmin: false, // Explicitly set to false - this is a tenant admin
          isActive: true,
          isFirstLogin: false
        }, { transaction });
        
        console.log('✅ Admin user created successfully!');
        
        // Create tenant for admin
        const slug = await generateUniqueSlug('Eric Amankyim Company', transaction);
        const trialEndDate = dayjs().add(1, 'month').toDate();
        
        tenant = await Tenant.create({
          name: 'Eric Amankyim Company',
          slug,
          plan: 'trial',
          status: 'active',
          metadata: {},
          trialEndsAt: trialEndDate
        }, { transaction });
        
        // Link admin to tenant
        await UserTenant.create({
          userId: admin.id,
          tenantId: tenant.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          joinedAt: new Date()
        }, { transaction });
        
        console.log('✅ Tenant created and linked to admin:', tenant.name);
      }
      
      await transaction.commit();
      
      console.log('\n📧 Tenant Admin Login Credentials:');
      console.log('   Name: Eric Amankyim');
      console.log('   Email: eamankyim@gmail.com');
      console.log('   Password: 199855@EricAdmin');
      console.log('   Role: Tenant Admin (NOT Platform Admin)');
      console.log('\n🏢 Tenant Information:');
      console.log('   Name:', tenant.name);
      console.log('   Slug:', tenant.slug);
      console.log('   Plan:', tenant.plan);
      console.log('\n⚠️  IMPORTANT: Change the password after first login!');
      console.log('\n💡 Note: Platform Admin (superadmin@nexpro.com) is separate and should be seeded using: npm run seed-platform-admin');
      console.log('\n🎉 Tenant admin is ready to use!\n');
      
      await sequelize.close();
      process.exit(0);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    await sequelize.close();
    process.exit(1);
  }
};

seedAdmin();

