/**
 * Migration: Seed default product categories for all tenants
 * 
 * Creates default product categories for each tenant based on their
 * business type and studio type (if applicable).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { getDefaultCategories, DEFAULT_CATEGORIES } = require('../config/productCategories');
const { resolveBusinessType } = require('../config/businessTypes');

const seedDefaultProductCategories = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🌱 Seeding default product categories for all tenants...');

  try {
    // Get all tenants with their business type, studio type, and shop type
    const tenants = await sequelize.query(`
      SELECT 
        id,
        "businessType",
        metadata->>'studioType' as "studioType",
        metadata->>'shopType' as "shopType"
      FROM tenants
      WHERE status = 'active'
    `, { type: QueryTypes.SELECT });

    console.log(`Found ${tenants.length} active tenants`);

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      const businessType = resolveBusinessType(tenant.businessType);
      const studioType = tenant.studioType || null;
      const shopType = tenant.shopType || null;

      // Get default PRODUCT categories (from productCategories.js; restaurant = menu, not ingredients)
      const defaultCategories = getDefaultCategories(businessType, studioType, shopType);

      if (defaultCategories.length === 0) {
        console.log(`  ⚠️  Tenant ${tenant.id} (${businessType}${shopType ? `/${shopType}` : ''}${studioType ? `/${studioType}` : ''}): No default categories defined`);
        continue;
      }

      console.log(`  📋 Tenant ${tenant.id} (${businessType}${shopType ? `/${shopType}` : ''}${studioType ? `/${studioType}` : ''}): Creating ${defaultCategories.length} categories`);

      for (const category of defaultCategories) {
        try {
          // Check if category already exists for this tenant
          const existing = await sequelize.query(`
            SELECT id FROM product_categories
            WHERE "tenantId" = :tenantId AND name = :name
          `, {
            replacements: { tenantId: tenant.id, name: category.name },
            type: QueryTypes.SELECT
          });

          if (existing.length > 0) {
            // Update existing category
            await sequelize.query(`
              UPDATE product_categories
              SET description = COALESCE(description, :description), "updatedAt" = NOW()
              WHERE id = :id
            `, {
              replacements: {
                id: existing[0].id,
                description: category.description || null
              }
            });
            totalSkipped++;
          } else {
            // Create new category (id, tenantId, name, description, isActive, createdAt, updatedAt)
            await sequelize.query(`
              INSERT INTO product_categories (
                id, "tenantId", name, description, "isActive", "createdAt", "updatedAt"
              )
              VALUES (
                gen_random_uuid(),
                :tenantId,
                :name,
                :description,
                true,
                NOW(),
                NOW()
              )
            `, {
              replacements: {
                tenantId: tenant.id,
                name: category.name,
                description: category.description || null
              }
            });
            totalCreated++;
          }
        } catch (error) {
          console.error(`    ❌ Error creating category "${category.name}":`, error.message);
        }
      }

      // For shop+shopType tenants: deactivate generic shop categories that don't apply
      // (e.g. Electronics, Clothing for a restaurant - they were seeded before we had shop-type support)
      if (businessType === 'shop' && shopType) {
        const shopTypeNames = new Set(defaultCategories.map((c) => c.name));
        const genericShopNames = [
          ...(DEFAULT_CATEGORIES.shop || []).map((c) => c.name),
          'General Merchandise',
          'Miscellaneous'
        ];
        const toDeactivate = genericShopNames.filter((n) => !shopTypeNames.has(n));
        if (toDeactivate.length > 0) {
          await sequelize.query(
            `UPDATE product_categories SET "isActive" = false
             WHERE "tenantId" = :tenantId AND name IN (:names) AND "isActive" = true`,
            {
              replacements: { tenantId: tenant.id, names: toDeactivate }
            }
          );
          console.log(`  🔄 Tenant ${tenant.id}: Deactivated generic shop categories (${toDeactivate.length} types)`);
        }
      }
    }

    console.log(`✅ Seeding completed: ${totalCreated} categories created, ${totalSkipped} already existed`);

    if (closeConnection) {
      await sequelize.close();
    }
  } catch (error) {
    console.error('❌ Error seeding default product categories:', error);
    throw error;
  }
};

if (require.main === module) {
  seedDefaultProductCategories()
    .then(() => {
      console.log('✅ Seeding completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = seedDefaultProductCategories;
