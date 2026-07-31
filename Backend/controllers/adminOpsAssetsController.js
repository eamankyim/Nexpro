const platformOpsAssetsService = require('../services/platformOpsAssetsService');

/**
 * List IT Ops assets.
 * @route GET /api/admin/ops/assets
 */
exports.listOpsAssets = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.listAssets({
      type: req.query.type,
      status: req.query.status,
      search: req.query.search,
      expiryWindow: req.query.expiryWindow,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Expiry / type stats.
 * @route GET /api/admin/ops/stats
 */
exports.getOpsStats = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.getStats();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Platform customers for linking to ops assets.
 * @route GET /api/admin/ops/customers
 */
exports.listOpsCustomers = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.listCustomerOptions();
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a platform customer from IT Ops.
 * @route POST /api/admin/ops/customers
 */
exports.createOpsCustomer = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.createCustomer(req.body);
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Create asset.
 * @route POST /api/admin/ops/assets
 */
exports.createOpsAsset = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.createAsset(req.body, req.user?.id);
    res.status(201).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Update asset.
 * @route PATCH /api/admin/ops/assets/:id
 */
exports.updateOpsAsset = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.updateAsset(req.params.id, req.body, req.user?.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Soft-archive asset.
 * @route DELETE /api/admin/ops/assets/:id
 */
exports.archiveOpsAsset = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.archiveAsset(req.params.id, req.user?.id);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    res.status(200).json({ success: true, data, message: 'Asset archived' });
  } catch (error) {
    next(error);
  }
};

/**
 * Start step-up reveal challenge (sends OTP to OPS_ASSETS_SECRET_EMAIL).
 * @route POST /api/admin/ops/assets/:id/reveal/challenge
 */
exports.challengeOpsReveal = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.startRevealChallenge({
      assetId: req.params.id,
      userId: req.user?.id,
      userName: req.user?.name,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Confirm email OTP and return plaintext secret.
 * @route POST /api/admin/ops/assets/:id/reveal/confirm
 */
exports.confirmOpsReveal = async (req, res, next) => {
  try {
    const data = await platformOpsAssetsService.confirmReveal({
      assetId: req.params.id,
      userId: req.user?.id,
      code: req.body?.code,
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * Reveal audit trail for an asset.
 * @route GET /api/admin/ops/assets/:id/reveals
 */
exports.listOpsReveals = async (req, res, next) => {
  try {
    const asset = await platformOpsAssetsService.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }
    const rows = await platformOpsAssetsService.listReveals(req.params.id);
    res.status(200).json({
      success: true,
      data: rows.map((r) => {
        const plain = r.toJSON ? r.toJSON() : r;
        return {
          id: plain.id,
          method: plain.method,
          success: plain.success,
          createdAt: plain.createdAt,
          requester: plain.requester
            ? { id: plain.requester.id, name: plain.requester.name, email: plain.requester.email }
            : null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};
