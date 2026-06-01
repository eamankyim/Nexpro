const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * @deprecated Unsafe for production — resets every tenant to trial.
 * Use backfill-trial-plan-defaults.js instead (null/missing plan only).
 */
async function up(options = {}) {
  const { closeConnection = true } = options;
  console.warn(
    '[Migration] normalize-tenant-plans-to-trial is deprecated and skipped. ' +
      'Run: node migrations/backfill-trial-plan-defaults.js'
  );
  if (closeConnection) {
    const { sequelize } = require('../config/database');
    await sequelize.close();
  }
}

module.exports = { up };

if (require.main === module) {
  up();
}
