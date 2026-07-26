const path = require('path');
const fs = require('fs');
const {
  OnlineStoreHeroCategory,
  OnlineStoreHeroDesign,
  OnlineStoreHeroColorway,
} = require('../models');
const { pickClosestColorway } = require('../utils/heroColorMatch');
const { normalizeHarmonyHex } = require('../utils/colorHarmony');

const MAX_HERO_SLIDES = 5;
const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

const baseUploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', 'uploads');

const ensureDirExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'category';

const compact = (value, max = 200) => {
  const s = String(value || '').trim();
  return s ? s.slice(0, max) : '';
};

const toBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
};

const toInt = (value, fallback = 0) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const serializeColorway = (row) => {
  const plain = row?.toJSON ? row.toJSON() : row;
  if (!plain) return null;
  return {
    id: plain.id,
    designId: plain.designId,
    label: plain.label,
    hexHint: plain.hexHint,
    imageUrl: plain.imageUrl,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
  };
};

const serializeDesign = (row, { includeInactiveColorways = false } = {}) => {
  const plain = row?.toJSON ? row.toJSON() : row;
  if (!plain) return null;
  let colorways = Array.isArray(plain.colorways) ? plain.colorways : [];
  if (!includeInactiveColorways) {
    colorways = colorways.filter((c) => c.isActive !== false);
  }
  colorways = [...colorways].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return {
    id: plain.id,
    categoryId: plain.categoryId,
    name: plain.name,
    description: plain.description,
    thumbnailUrl: plain.thumbnailUrl || colorways[0]?.imageUrl || null,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    colorways: colorways.map(serializeColorway),
    category: plain.category
      ? {
          id: plain.category.id,
          slug: plain.category.slug,
          name: plain.category.name,
        }
      : undefined,
  };
};

const serializeCategory = (row, { includeDesigns = false, activeDesignsOnly = true } = {}) => {
  const plain = row?.toJSON ? row.toJSON() : row;
  if (!plain) return null;
  let designs = Array.isArray(plain.designs) ? plain.designs : [];
  if (activeDesignsOnly) {
    designs = designs.filter((d) => d.isActive !== false);
  }
  designs = [...designs].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  return {
    id: plain.id,
    slug: plain.slug,
    name: plain.name,
    sortOrder: plain.sortOrder,
    isActive: plain.isActive,
    ...(includeDesigns
      ? {
          designs: designs.map((d) =>
            serializeDesign(d, { includeInactiveColorways: !activeDesignsOnly })
          ),
        }
      : {}),
  };
};

const designInclude = (activeOnly) => ([
  {
    model: OnlineStoreHeroColorway,
    as: 'colorways',
    required: false,
    ...(activeOnly ? { where: { isActive: true } } : {}),
  },
  {
    model: OnlineStoreHeroCategory,
    as: 'category',
    required: false,
  },
]);

const saveHeroImageFile = (file, subfolder = 'heroes') => {
  if (!file) return null;
  const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  if (isServerless) {
    const mime = file.mimetype || 'image/jpeg';
    return `data:${mime};base64,${file.buffer.toString('base64')}`;
  }
  const subDir = path.join('online-store-heroes', subfolder);
  const uploadPath = path.join(baseUploadDir, subDir);
  ensureDirExists(uploadPath);
  const ext = path.extname(file.originalname) || '.jpg';
  const sanitized =
    file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.[^.]+$/, '') || 'hero';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitized}${ext}`;
  const buffer = file.buffer || (file.path ? fs.readFileSync(file.path) : null);
  if (!buffer) return null;
  fs.writeFileSync(path.join(uploadPath, filename), buffer);
  return `/uploads/online-store-heroes/${subfolder}/${filename}`;
};

/**
 * Normalize merchant heroSlides and resolve library colorways against primaryColor.
 * @param {Array} slides
 * @param {string} primaryColor
 * @param {Map<string, object>} designMap id → design with colorways
 * @returns {Array}
 */
const normalizeAndResolveHeroSlides = (slides, primaryColor, designMap = new Map()) => {
  const list = Array.isArray(slides) ? slides : [];
  const resolved = [];

  for (let i = 0; i < list.length && resolved.length < MAX_HERO_SLIDES; i += 1) {
    const raw = list[i] || {};
    const type = raw.type === 'upload' ? 'upload' : 'library';
    const sortOrder = resolved.length;

    if (type === 'upload') {
      const imageUrl = compact(raw.imageUrl, 2000);
      if (!imageUrl) continue;
      resolved.push({
        type: 'upload',
        imageUrl,
        sortOrder,
      });
      continue;
    }

    const designId = compact(raw.designId, 80);
    if (!designId) continue;
    const design = designMap.get(designId);
    const colorways = design?.colorways || [];
    let colorway =
      (raw.colorwayId && colorways.find((c) => c.id === raw.colorwayId && c.isActive !== false)) ||
      pickClosestColorway(colorways, primaryColor);

    if (!colorway?.imageUrl) continue;

    resolved.push({
      type: 'library',
      designId,
      colorwayId: colorway.id,
      imageUrl: colorway.imageUrl,
      sortOrder,
    });
  }

  return resolved;
};

/**
 * Load designs map for resolve.
 */
const loadDesignMap = async (designIds) => {
  const ids = [...new Set((designIds || []).filter(Boolean))];
  if (!ids.length) return new Map();
  const rows = await OnlineStoreHeroDesign.findAll({
    where: { id: ids },
    include: designInclude(false),
  });
  const map = new Map();
  rows.forEach((row) => {
    map.set(row.id, serializeDesign(row, { includeInactiveColorways: false }));
  });
  return map;
};

/**
 * Public helper used by storeController when serializing settings / public store.
 */
const resolveHeroSlidesForStore = async (heroSlides, primaryColor) => {
  const list = Array.isArray(heroSlides) ? heroSlides : [];
  const designIds = list.filter((s) => s?.type !== 'upload').map((s) => s.designId);
  const designMap = await loadDesignMap(designIds);
  return normalizeAndResolveHeroSlides(list, primaryColor, designMap);
};

// ——— Admin: categories ———

exports.listAdminHeroCategories = async (req, res, next) => {
  try {
    const rows = await OnlineStoreHeroCategory.findAll({
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: OnlineStoreHeroDesign,
          as: 'designs',
          required: false,
          include: [
            {
              model: OnlineStoreHeroColorway,
              as: 'colorways',
              required: false,
            },
          ],
        },
      ],
    });
    res.json({
      success: true,
      data: rows.map((r) => serializeCategory(r, { includeDesigns: true, activeDesignsOnly: false })),
    });
  } catch (error) {
    next(error);
  }
};

exports.createAdminHeroCategory = async (req, res, next) => {
  try {
    const name = compact(req.body.name, 120);
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    let slug = slugify(req.body.slug || name);
    const existing = await OnlineStoreHeroCategory.findOne({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }
    const row = await OnlineStoreHeroCategory.create({
      name,
      slug,
      sortOrder: toInt(req.body.sortOrder, 0),
      isActive: toBool(req.body.isActive, true),
    });
    res.status(201).json({ success: true, data: serializeCategory(row) });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminHeroCategory = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroCategory.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (req.body.name != null) row.name = compact(req.body.name, 120) || row.name;
    if (req.body.slug != null) row.slug = slugify(req.body.slug) || row.slug;
    if (req.body.sortOrder != null) row.sortOrder = toInt(req.body.sortOrder, row.sortOrder);
    if (req.body.isActive != null) row.isActive = toBool(req.body.isActive, row.isActive);
    await row.save();
    res.json({ success: true, data: serializeCategory(row) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdminHeroCategory = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroCategory.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    await row.destroy();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

// ——— Admin: designs ———

exports.createAdminHeroDesign = async (req, res, next) => {
  try {
    const categoryId = compact(req.body.categoryId, 80);
    const name = compact(req.body.name, 160);
    if (!categoryId || !name) {
      return res.status(400).json({ success: false, message: 'categoryId and name are required' });
    }
    const category = await OnlineStoreHeroCategory.findByPk(categoryId);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category not found' });
    }
    const thumbnailFromFile = req.file ? saveHeroImageFile(req.file, 'thumbnails') : null;
    const row = await OnlineStoreHeroDesign.create({
      categoryId,
      name,
      description: compact(req.body.description, 2000) || null,
      thumbnailUrl: thumbnailFromFile || compact(req.body.thumbnailUrl, 2000) || null,
      sortOrder: toInt(req.body.sortOrder, 0),
      isActive: toBool(req.body.isActive, true),
    });
    const full = await OnlineStoreHeroDesign.findByPk(row.id, { include: designInclude(false) });
    res.status(201).json({ success: true, data: serializeDesign(full, { includeInactiveColorways: true }) });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminHeroDesign = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroDesign.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Design not found' });
    }
    if (req.body.categoryId != null) {
      const categoryId = compact(req.body.categoryId, 80);
      const category = await OnlineStoreHeroCategory.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found' });
      }
      row.categoryId = categoryId;
    }
    if (req.body.name != null) row.name = compact(req.body.name, 160) || row.name;
    if (req.body.description != null) row.description = compact(req.body.description, 2000) || null;
    if (req.file) {
      row.thumbnailUrl = saveHeroImageFile(req.file, 'thumbnails') || row.thumbnailUrl;
    } else if (req.body.thumbnailUrl != null) {
      row.thumbnailUrl = compact(req.body.thumbnailUrl, 2000) || null;
    }
    if (req.body.sortOrder != null) row.sortOrder = toInt(req.body.sortOrder, row.sortOrder);
    if (req.body.isActive != null) row.isActive = toBool(req.body.isActive, row.isActive);
    await row.save();
    const full = await OnlineStoreHeroDesign.findByPk(row.id, { include: designInclude(false) });
    res.json({ success: true, data: serializeDesign(full, { includeInactiveColorways: true }) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdminHeroDesign = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroDesign.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Design not found' });
    }
    await row.destroy();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

// ——— Admin: colorways ———

exports.createAdminHeroColorway = async (req, res, next) => {
  try {
    const designId = compact(req.body.designId || req.params.designId, 80);
    const label = compact(req.body.label, 80);
    if (!designId || !label) {
      return res.status(400).json({ success: false, message: 'designId and label are required' });
    }
    const design = await OnlineStoreHeroDesign.findByPk(designId);
    if (!design) {
      return res.status(400).json({ success: false, message: 'Design not found' });
    }
    const imageFromFile = req.file ? saveHeroImageFile(req.file, 'colorways') : null;
    const imageUrl = imageFromFile || compact(req.body.imageUrl, 2000);
    if (!imageUrl) {
      return res.status(400).json({ success: false, message: 'Colorway image is required' });
    }
    let hexHint = compact(req.body.hexHint, 24) || null;
    if (hexHint && !HEX_PATTERN.test(hexHint)) {
      hexHint = normalizeHarmonyHex(hexHint);
    }
    const row = await OnlineStoreHeroColorway.create({
      designId,
      label,
      hexHint,
      imageUrl,
      sortOrder: toInt(req.body.sortOrder, 0),
      isActive: toBool(req.body.isActive, true),
    });
    if (!design.thumbnailUrl) {
      design.thumbnailUrl = imageUrl;
      await design.save();
    }
    res.status(201).json({ success: true, data: serializeColorway(row) });
  } catch (error) {
    next(error);
  }
};

exports.updateAdminHeroColorway = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroColorway.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Colorway not found' });
    }
    if (req.body.label != null) row.label = compact(req.body.label, 80) || row.label;
    if (req.body.hexHint != null) {
      const hint = compact(req.body.hexHint, 24);
      row.hexHint = hint ? normalizeHarmonyHex(hint) || hint : null;
    }
    if (req.file) {
      row.imageUrl = saveHeroImageFile(req.file, 'colorways') || row.imageUrl;
    } else if (req.body.imageUrl != null) {
      row.imageUrl = compact(req.body.imageUrl, 2000) || row.imageUrl;
    }
    if (req.body.sortOrder != null) row.sortOrder = toInt(req.body.sortOrder, row.sortOrder);
    if (req.body.isActive != null) row.isActive = toBool(req.body.isActive, row.isActive);
    await row.save();
    res.json({ success: true, data: serializeColorway(row) });
  } catch (error) {
    next(error);
  }
};

exports.deleteAdminHeroColorway = async (req, res, next) => {
  try {
    const row = await OnlineStoreHeroColorway.findByPk(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, message: 'Colorway not found' });
    }
    await row.destroy();
    res.json({ success: true, data: { id: req.params.id } });
  } catch (error) {
    next(error);
  }
};

exports.uploadAdminHeroImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    const imageUrl = saveHeroImageFile(req.file, compact(req.body.folder, 40) || 'general');
    if (!imageUrl) {
      return res.status(500).json({ success: false, message: 'Failed to save image' });
    }
    res.status(201).json({ success: true, data: { imageUrl } });
  } catch (error) {
    next(error);
  }
};

// ——— Merchant / authenticated catalog ———

exports.listHeroLibrary = async (req, res, next) => {
  try {
    const rows = await OnlineStoreHeroCategory.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      include: [
        {
          model: OnlineStoreHeroDesign,
          as: 'designs',
          required: false,
          where: { isActive: true },
          include: [
            {
              model: OnlineStoreHeroColorway,
              as: 'colorways',
              required: false,
              where: { isActive: true },
            },
          ],
        },
      ],
    });

    const primaryColor = compact(req.query.primaryColor, 24) || '#166534';
    const data = rows
      .map((r) => serializeCategory(r, { includeDesigns: true, activeDesignsOnly: true }))
      .map((cat) => ({
        ...cat,
        designs: (cat.designs || [])
          .filter((d) => (d.colorways || []).length > 0)
          .map((d) => {
            const matched = pickClosestColorway(d.colorways, primaryColor);
            return {
              ...d,
              matchedColorway: matched ? serializeColorway(matched) : null,
              previewImageUrl: matched?.imageUrl || d.thumbnailUrl || d.colorways[0]?.imageUrl || null,
            };
          }),
      }))
      .filter((cat) => (cat.designs || []).length > 0 || true);

    res.json({
      success: true,
      data: {
        maxSlides: MAX_HERO_SLIDES,
        primaryColor,
        categories: data,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resolveHeroSlidesForStore = resolveHeroSlidesForStore;
exports.normalizeAndResolveHeroSlides = normalizeAndResolveHeroSlides;
exports.loadDesignMap = loadDesignMap;
exports.MAX_HERO_SLIDES = MAX_HERO_SLIDES;
