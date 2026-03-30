const { sequelize } = require('../config/database');

/**
 * Normalize all tenant plan values to the canonical trial plan.
 * This intentionally removes legacy/paid plan values from tenants.plan.
 */
async function up(options = {}) {
  const { closeConnection = true } = options;
  try {
    const [_, metadata] = await sequelize.query(`
      UPDATE tenants
      SET plan = 'trial',
          "updatedAt" = NOW()
      WHERE plan IS DISTINCT FROM 'trial';
    `);

    const changedRows = Number(metadata?.rowCount || 0);
    console.log(`[Migration] normalize-tenant-plans-to-trial: updated ${changedRows} tenant(s) to trial`);
  } catch (error) {
    console.error('[Migration] normalize-tenant-plans-to-trial failed:', error.message);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
}

module.exports = { up };

if (require.main === module) {
  up();
}
