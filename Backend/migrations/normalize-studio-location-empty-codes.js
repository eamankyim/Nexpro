const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

/**
 * Empty string codes violate partial unique index (WHERE code IS NOT NULL treats '' as set).
 * Idempotent: only updates rows where code is blank after trim.
 */
const normalizeStudioLocationEmptyCodes = async () => {
  console.log('🔄 Normalizing blank studio location codes to NULL...');

  const [, meta] = await sequelize.query(`
    UPDATE studio_locations
    SET code = NULL, "updatedAt" = NOW()
    WHERE code IS NOT NULL AND BTRIM(code) = '';
  `);

  const updated = meta?.rowCount ?? 0;
  console.log(`✅ Normalized ${updated} studio location code(s) to NULL`);
};

if (require.main === module) {
  normalizeStudioLocationEmptyCodes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}

module.exports = normalizeStudioLocationEmptyCodes;
