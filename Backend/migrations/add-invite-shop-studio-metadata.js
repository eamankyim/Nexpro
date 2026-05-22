const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize, testConnection } = require('../config/database');
const { QueryTypes } = require('sequelize');

/**
 * Ensures invite_tokens.metadata stores studioLocationIds and shopIds for team invites,
 * and backfills user_studio_locations / user_shops from accepted invites when missing.
 */
const addInviteShopStudioMetadata = async () => {
  const isDirect = require.main === module;
  try {
    console.log('🔄 Invite shop/studio metadata migration...\n');
    if (isDirect) await testConnection();

    const tables = await sequelize.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND lower(table_name) IN ('invite_tokens', 'user_shops', 'user_studio_locations');
    `,
      { type: QueryTypes.SELECT }
    );
    const tableNames = new Set(tables.map((r) => String(r.table_name).toLowerCase()));

    if (!tableNames.has('invite_tokens')) {
      console.log('⏭️  invite_tokens table not found, skipping');
      if (isDirect) process.exit(0);
      return;
    }

    console.log('  ➡️  Ensuring invite_tokens.metadata column...');
    await sequelize.query(`
      ALTER TABLE invite_tokens
      ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);

    console.log('  ➡️  Normalizing metadata.studioLocationIds and metadata.shopIds...');
    await sequelize.query(`
      UPDATE invite_tokens
      SET metadata = jsonb_build_object(
        'studioLocationIds',
        COALESCE(
          CASE
            WHEN jsonb_typeof(metadata->'studioLocationIds') = 'array'
            THEN metadata->'studioLocationIds'
            ELSE '[]'::jsonb
          END,
          '[]'::jsonb
        ),
        'shopIds',
        COALESCE(
          CASE
            WHEN jsonb_typeof(metadata->'shopIds') = 'array'
            THEN metadata->'shopIds'
            ELSE '[]'::jsonb
          END,
          '[]'::jsonb
        )
      )
      || (metadata - 'studioLocationIds' - 'shopIds')
      WHERE metadata IS NULL
         OR metadata->'studioLocationIds' IS NULL
         OR metadata->'shopIds' IS NULL
         OR jsonb_typeof(metadata->'studioLocationIds') != 'array'
         OR jsonb_typeof(metadata->'shopIds') != 'array';
    `);

    if (tableNames.has('user_studio_locations')) {
      console.log('  ➡️  Backfilling user_studio_locations from used invites...');
      await sequelize.query(`
        INSERT INTO user_studio_locations ("userId", "tenantId", "studioLocationId", "createdAt", "updatedAt")
        SELECT DISTINCT
          i."usedBy",
          i."tenantId",
          loc_id::uuid,
          NOW(),
          NOW()
        FROM invite_tokens i
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(i.metadata->'studioLocationIds', '[]'::jsonb)
        ) AS loc_id
        WHERE i.used = true
          AND i."usedBy" IS NOT NULL
          AND i."tenantId" IS NOT NULL
          AND loc_id IS NOT NULL
          AND loc_id <> ''
        ON CONFLICT ("userId", "studioLocationId") DO NOTHING;
      `);
    }

    if (tableNames.has('user_shops')) {
      console.log('  ➡️  Backfilling user_shops from used invites...');
      await sequelize.query(`
        INSERT INTO user_shops ("userId", "tenantId", "shopId", "createdAt", "updatedAt")
        SELECT DISTINCT
          i."usedBy",
          i."tenantId",
          shop_id::uuid,
          NOW(),
          NOW()
        FROM invite_tokens i
        CROSS JOIN LATERAL jsonb_array_elements_text(
          COALESCE(i.metadata->'shopIds', '[]'::jsonb)
        ) AS shop_id
        WHERE i.used = true
          AND i."usedBy" IS NOT NULL
          AND i."tenantId" IS NOT NULL
          AND shop_id IS NOT NULL
          AND shop_id <> ''
        ON CONFLICT ("userId", "shopId") DO NOTHING;
      `);
    }

    console.log('✅ Invite shop/studio metadata migration completed.\n');
    if (isDirect) process.exit(0);
  } catch (error) {
    console.error('❌ add-invite-shop-studio-metadata failed:', error);
    if (isDirect) process.exit(1);
    throw error;
  }
};

module.exports = addInviteShopStudioMetadata;

if (require.main === module) {
  addInviteShopStudioMetadata();
}
