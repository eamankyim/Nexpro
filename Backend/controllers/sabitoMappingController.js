const { SabitoTenantMapping, Tenant } = require('../models');

/**
 * Create or update Sabito business ID to NEXPro tenant ID mapping
 * POST /api/sabito/mappings
 * Headers: Authorization: Bearer <token>, X-Tenant-ID: <tenant-id>
 */
exports.createMapping = async (req, res, next) => {
  try {
    const { sabitoBusinessId, businessName } = req.body;
    const nexproTenantId = req.tenantId; // From tenant context middleware

    if (!sabitoBusinessId) {
      return res.status(400).json({
        success: false,
        message: 'sabitoBusinessId is required'
      });
    }

    // Verify tenant exists
    const tenant = await Tenant.findByPk(nexproTenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Create or update mapping
    const [mapping, created] = await SabitoTenantMapping.findOrCreate({
      where: { sabitoBusinessId },
      defaults: {
        nexproTenantId,
        businessName: businessName || tenant.name
      }
    });

    if (!created) {
      // Update existing mapping
      await mapping.update({
        nexproTenantId,
        businessName: businessName || tenant.name
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Mapping created successfully' : 'Mapping updated successfully',
      data: mapping
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all mappings for current tenant
 * GET /api/sabito/mappings
 */
exports.getMappings = async (req, res, next) => {
  try {
    const nexproTenantId = req.tenantId;
    
    const mappings = await SabitoTenantMapping.findAll({
      where: { nexproTenantId },
      include: [{
        model: Tenant,
        as: 'tenant'
      }]
    });

    res.status(200).json({
      success: true,
      data: mappings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a mapping
 * DELETE /api/sabito/mappings/:id
 */
exports.deleteMapping = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nexproTenantId = req.tenantId;

    const mapping = await SabitoTenantMapping.findOne({
      where: { id, nexproTenantId }
    });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Mapping not found'
      });
    }

    await mapping.destroy();

    res.status(200).json({
      success: true,
      message: 'Mapping deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update mapping by business ID (called by Sabito after SSO)
 * PUT /api/sabito/mappings/by-business-id/:businessId
 * Headers: Authorization: Bearer <token>, X-Tenant-ID: <tenant-id>
 */
exports.updateMappingByBusinessId = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { businessName } = req.body;
    const nexproTenantId = req.tenantId;

    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'businessId is required'
      });
    }

    // Verify tenant exists
    const tenant = await Tenant.findByPk(nexproTenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Find or create mapping
    const [mapping, created] = await SabitoTenantMapping.findOrCreate({
      where: { sabitoBusinessId: businessId },
      defaults: {
        nexproTenantId,
        businessName: businessName || tenant.name
      }
    });

    if (!created) {
      // Update existing mapping
      await mapping.update({
        nexproTenantId,
        businessName: businessName || tenant.name
      });
    }

    res.status(created ? 201 : 200).json({
      success: true,
      message: created ? 'Mapping created successfully' : 'Mapping updated successfully',
      data: mapping
    });
  } catch (error) {
    next(error);
  }
};

