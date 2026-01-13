const sabitoSyncService = require('../services/sabitoSyncService');
const { SabitoTenantMapping } = require('../models');

/**
 * Manually trigger sync for all tenants
 * POST /api/sabito/sync
 */
exports.triggerSync = async (req, res, next) => {
  try {
    const { fullSync = false } = req.body;

    const results = await sabitoSyncService.syncAllTenants({ fullSync });

    res.status(200).json({
      success: true,
      message: 'Sync completed',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync customers for a specific tenant mapping
 * POST /api/sabito/sync/:mappingId
 */
exports.syncTenant = async (req, res, next) => {
  try {
    const { mappingId } = req.params;
    const { fullSync = false } = req.body;

    const mapping = await SabitoTenantMapping.findByPk(mappingId, {
      include: [{
        model: require('../models').Tenant,
        as: 'tenant'
      }]
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Tenant mapping not found'
      });
    }

    const result = await sabitoSyncService.syncTenantCustomers(mapping, { fullSync });

    res.status(200).json({
      success: true,
      message: 'Sync completed',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sync status for all mappings
 * GET /api/sabito/sync/status
 */
exports.getSyncStatus = async (req, res, next) => {
  try {
    const mappings = await SabitoTenantMapping.findAll({
      include: [{
        model: require('../models').Tenant,
        as: 'tenant'
      }],
      attributes: ['id', 'sabitoBusinessId', 'businessName', 'metadata', 'updatedAt']
    });

    const status = mappings.map(mapping => ({
      id: mapping.id,
      sabitoBusinessId: mapping.sabitoBusinessId,
      businessName: mapping.businessName,
      tenantName: mapping.tenant?.name,
      lastSyncAt: mapping.metadata?.lastSyncedAt || null,
      lastSyncResult: mapping.metadata?.lastSyncResult || null,
      lastUpdated: mapping.updatedAt
    }));

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
};




