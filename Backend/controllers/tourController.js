const { UserTenant } = require('../models');
const { Op } = require('sequelize');

/**
 * Get tour completion status for current user/tenant
 * GET /api/tours/status
 */
const getTourStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Find user-tenant relationship
    const userTenant = await UserTenant.findOne({
      where: {
        userId,
        tenantId,
        status: 'active'
      }
    });

    if (!userTenant) {
      return res.status(404).json({
        success: false,
        error: 'User-tenant relationship not found'
      });
    }

    // Get tours from metadata, default to empty object
    const tours = userTenant.metadata?.tours || {};

    return res.json({
      success: true,
      data: {
        tours
      }
    });
  } catch (error) {
    console.error('[Tour Controller] Error getting tour status:', error);
    next(error);
  }
};

/**
 * Mark a tour as completed
 * POST /api/tours/complete
 */
const completeTour = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.tenantId;
    const { tourId, version } = req.body;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!tourId) {
      return res.status(400).json({
        success: false,
        error: 'Tour ID is required'
      });
    }

    // Find user-tenant relationship
    const userTenant = await UserTenant.findOne({
      where: {
        userId,
        tenantId,
        status: 'active'
      }
    });

    if (!userTenant) {
      return res.status(404).json({
        success: false,
        error: 'User-tenant relationship not found'
      });
    }

    // Update metadata atomically
    const currentMetadata = userTenant.metadata || {};
    const currentTours = currentMetadata.tours || {};

    const updatedTours = {
      ...currentTours,
      [tourId]: {
        completed: true,
        completedAt: new Date().toISOString(),
        ...(version && { version })
      }
    };

    await userTenant.update({
      metadata: {
        ...currentMetadata,
        tours: updatedTours
      }
    });

    return res.json({
      success: true,
      data: {
        tours: updatedTours
      }
    });
  } catch (error) {
    console.error('[Tour Controller] Error completing tour:', error);
    next(error);
  }
};

/**
 * Reset a tour (mark as not completed)
 * POST /api/tours/reset
 */
const resetTour = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.tenantId;
    const { tourId } = req.body;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    if (!tourId) {
      return res.status(400).json({
        success: false,
        error: 'Tour ID is required'
      });
    }

    // Find user-tenant relationship
    const userTenant = await UserTenant.findOne({
      where: {
        userId,
        tenantId,
        status: 'active'
      }
    });

    if (!userTenant) {
      return res.status(404).json({
        success: false,
        error: 'User-tenant relationship not found'
      });
    }

    // Update metadata atomically
    const currentMetadata = userTenant.metadata || {};
    const currentTours = currentMetadata.tours || {};

    // Remove the tour from completed tours
    const updatedTours = { ...currentTours };
    delete updatedTours[tourId];

    await userTenant.update({
      metadata: {
        ...currentMetadata,
        tours: updatedTours
      }
    });

    return res.json({
      success: true,
      data: {
        tours: updatedTours
      }
    });
  } catch (error) {
    console.error('[Tour Controller] Error resetting tour:', error);
    next(error);
  }
};

module.exports = {
  getTourStatus,
  completeTour,
  resetTour
};
