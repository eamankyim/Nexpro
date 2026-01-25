/**
 * Category Seeder Utility
 * 
 * Seeds default inventory categories based on business type and shop type.
 * Used during tenant onboarding to set up initial categories.
 */

const { InventoryCategory } = require('../models');
const { getDefaultCategoriesForShopType } = require('../config/shopTypes');

/**
 * Default categories for printing press
 */
const PRINTING_PRESS_CATEGORIES = [
  { name: 'Paper & Substrates', description: 'Paper stocks, vinyl, canvas, label materials, and other printable media.' },
  { name: 'Plates & Screens', description: 'Offset plates, flexographic plates, screen mesh, stencil supplies, and related consumables.' },
  { name: 'Inks & Toners', description: 'Process inks, spot colors, toners, UV inks, additives, and specialty formulations.' },
  { name: 'Coatings & Laminates', description: 'Aqueous and UV coatings, varnishes, laminating films, and protective finishes.' },
  { name: 'Binding & Finishing Supplies', description: 'Binding wires, staples, adhesives, cutting blades, shrink wraps, and finishing consumables.' },
  { name: 'Packaging & Shipping', description: 'Boxes, envelopes, tubes, tapes, pallets, and other packaging materials.' },
  { name: 'Maintenance & Cleaning', description: 'Rollers, blankets, filters, lubricants, press wash, wipes, safety gear, and maintenance supplies.' },
  { name: 'Digital Printing Media', description: 'Signage media, fabric substrates, magnet sheets, transfer papers, and specialty digital media.' },
  { name: 'Promotional & Miscellaneous', description: 'Promotional blanks, POS materials, specialty accessories, and miscellaneous items.' }
];

/**
 * Default categories for pharmacy
 */
const PHARMACY_CATEGORIES = [
  { name: 'Prescription Drugs', description: 'Prescription medications and controlled substances' },
  { name: 'Over-the-Counter', description: 'OTC medications and health products' },
  { name: 'Vitamins & Supplements', description: 'Vitamins and dietary supplements' },
  { name: 'Personal Care', description: 'Health and personal care products' },
  { name: 'Medical Supplies', description: 'Medical equipment and supplies' },
  { name: 'Baby Care', description: 'Baby health and care products' },
  { name: 'First Aid', description: 'First aid supplies and bandages' }
];

/**
 * Seed default inventory categories for a tenant
 * @param {string} tenantId - The tenant ID
 * @param {string} businessType - The business type ('printing_press', 'shop', 'pharmacy')
 * @param {string} shopType - The shop type (only if businessType is 'shop')
 * @returns {Promise<Array>} Array of created category IDs
 */
async function seedDefaultCategories(tenantId, businessType, shopType = null) {
  let categories = [];

  // Determine categories based on business type
  if (businessType === 'printing_press') {
    categories = PRINTING_PRESS_CATEGORIES;
  } else if (businessType === 'shop' && shopType) {
    // Get categories from shop type configuration
    categories = getDefaultCategoriesForShopType(shopType);
  } else if (businessType === 'pharmacy') {
    categories = PHARMACY_CATEGORIES;
  } else {
    // Default fallback - general categories
    categories = [
      { name: 'General Merchandise', description: 'General store items' },
      { name: 'Miscellaneous', description: 'Other products and items' }
    ];
  }

  // Create categories for tenant
  const createdCategories = [];
  for (const category of categories) {
    try {
      const [createdCategory, created] = await InventoryCategory.findOrCreate({
        where: {
          tenantId,
          name: category.name
        },
        defaults: {
          tenantId,
          name: category.name,
          description: category.description || null,
          isActive: true
        }
      });
      
      if (created) {
        createdCategories.push(createdCategory);
        console.log(`✅ Created category: ${category.name} for tenant ${tenantId}`);
      } else {
        console.log(`ℹ️  Category already exists: ${category.name} for tenant ${tenantId}`);
      }
    } catch (error) {
      console.error(`❌ Error creating category ${category.name}:`, error.message);
      // Continue with other categories even if one fails
    }
  }

  return createdCategories;
}

module.exports = {
  seedDefaultCategories,
  PRINTING_PRESS_CATEGORIES,
  PHARMACY_CATEGORIES
};
