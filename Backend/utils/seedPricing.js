require('dotenv').config();
const { sequelize } = require('../config/database');
const { PricingTemplate, Tenant } = require('../models');

/**
 * Seed pricing templates into the database
 * Can seed for all tenants or a specific tenant
 */

const pricingTemplates = [
  // Photocopying Services
  {
    name: 'A4 Black & White Photocopy',
    category: 'Photocopying',
    jobType: 'photocopy',
    paperType: 'Standard',
    paperSize: 'A4',
    materialType: 'Paper',
    colorType: 'black_white',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 0.50,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'Standard A4 black and white photocopying service'
  },
  {
    name: 'A4 Color Photocopy',
    category: 'Photocopying',
    jobType: 'photocopy',
    paperType: 'Standard',
    paperSize: 'A4',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 2.00,
    minimumQuantity: 1,
    setupFee: 0,
    discountTiers: [
      { minQuantity: 100, maxQuantity: 499, discountPercent: 5 },
      { minQuantity: 500, maxQuantity: 999, discountPercent: 10 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 15 }
    ],
    isActive: true,
    description: 'A4 color photocopying service with volume discounts'
  },
  {
    name: 'A3 Black & White Photocopy',
    category: 'Photocopying',
    jobType: 'photocopy',
    paperType: 'Standard',
    paperSize: 'A3',
    materialType: 'Paper',
    colorType: 'black_white',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 1.00,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'A3 black and white photocopying service'
  },
  {
    name: 'A3 Color Photocopy',
    category: 'Photocopying',
    jobType: 'photocopy',
    paperType: 'Standard',
    paperSize: 'A3',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 3.50,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'A3 color photocopying service'
  },

  // Business Cards
  {
    name: 'Standard Business Cards',
    category: 'Business Cards',
    jobType: 'business_cards',
    paperType: 'Standard',
    paperSize: '3.5x2',
    materialType: 'Cardstock',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 50.00,
    pricePerUnit: 0.10,
    minimumQuantity: 100,
    setupFee: 25.00,
    discountTiers: [
      { minQuantity: 500, maxQuantity: 999, discountPercent: 5 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 10 }
    ],
    additionalOptions: [
      { name: 'Lamination', price: 0.05 },
      { name: 'UV Coating', price: 0.08 },
      { name: 'Spot Color', price: 0.15 }
    ],
    isActive: true,
    description: 'Standard business cards with optional enhancements'
  },
  {
    name: 'Premium Business Cards',
    category: 'Business Cards',
    jobType: 'business_cards',
    paperType: 'Premium',
    paperSize: '3.5x2',
    materialType: 'Cardstock',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 75.00,
    pricePerUnit: 0.15,
    minimumQuantity: 100,
    setupFee: 35.00,
    discountTiers: [
      { minQuantity: 500, maxQuantity: 999, discountPercent: 8 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 12 }
    ],
    isActive: true,
    description: 'Premium quality business cards on high-grade cardstock'
  },

  // Flyers & Brochures
  {
    name: 'Flyer Printing - Standard',
    category: 'Flyers',
    jobType: 'flyers',
    paperType: 'Standard',
    paperSize: '8.5x11',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 100.00,
    pricePerUnit: 0.25,
    minimumQuantity: 100,
    setupFee: 50.00,
    discountTiers: [
      { minQuantity: 500, maxQuantity: 999, discountPercent: 10 },
      { minQuantity: 1000, maxQuantity: 4999, discountPercent: 15 },
      { minQuantity: 5000, maxQuantity: null, discountPercent: 20 }
    ],
    isActive: true,
    description: 'Standard flyer printing on regular paper'
  },
  {
    name: 'Flyer Printing - Glossy',
    category: 'Flyers',
    jobType: 'flyers',
    paperType: 'Glossy',
    paperSize: '8.5x11',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 120.00,
    pricePerUnit: 0.30,
    minimumQuantity: 100,
    setupFee: 50.00,
    discountTiers: [
      { minQuantity: 500, maxQuantity: 999, discountPercent: 10 },
      { minQuantity: 1000, maxQuantity: null, discountPercent: 15 }
    ],
    isActive: true,
    description: 'Flyer printing on glossy paper for enhanced appearance'
  },
  {
    name: 'Brochure Printing',
    category: 'Brochures',
    jobType: 'brochures',
    paperType: 'Glossy',
    paperSize: '8.5x11',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 150.00,
    pricePerUnit: 0.50,
    minimumQuantity: 50,
    setupFee: 75.00,
    discountTiers: [
      { minQuantity: 200, maxQuantity: 499, discountPercent: 8 },
      { minQuantity: 500, maxQuantity: null, discountPercent: 12 }
    ],
    isActive: true,
    description: 'Tri-fold brochure printing on glossy paper'
  },

  // Large Format Printing
  {
    name: 'Banner Printing',
    category: 'Large Format',
    jobType: 'banner',
    materialType: 'Vinyl',
    colorType: 'color',
    pricingMethod: 'square_foot',
    basePrice: 0,
    pricePerSquareFoot: 15.00,
    minimumQuantity: 1,
    setupFee: 50.00,
    additionalOptions: [
      { name: 'Grommets', price: 2.00 },
      { name: 'Hemming', price: 3.00 },
      { name: 'Reinforced Edges', price: 5.00 }
    ],
    isActive: true,
    description: 'Large format banner printing on vinyl material'
  },
  {
    name: 'Poster Printing',
    category: 'Large Format',
    jobType: 'poster',
    paperType: 'Photo Paper',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'square_foot',
    basePrice: 0,
    pricePerSquareFoot: 8.00,
    minimumQuantity: 1,
    setupFee: 25.00,
    isActive: true,
    description: 'Poster printing on high-quality photo paper'
  },

  // T-Shirt Printing
  {
    name: 'T-Shirt Printing - Screen Print',
    category: 'Apparel',
    jobType: 'tshirt',
    materialType: 'Fabric',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 25.00,
    minimumQuantity: 12,
    setupFee: 100.00,
    discountTiers: [
      { minQuantity: 24, maxQuantity: 47, discountPercent: 5 },
      { minQuantity: 48, maxQuantity: 99, discountPercent: 10 },
      { minQuantity: 100, maxQuantity: null, discountPercent: 15 }
    ],
    additionalOptions: [
      { name: 'Additional Color', price: 5.00 },
      { name: 'Rush Order (3 days)', price: 50.00 }
    ],
    isActive: true,
    description: 'Screen printing on t-shirts with volume discounts'
  },
  {
    name: 'T-Shirt Printing - Digital',
    category: 'Apparel',
    jobType: 'tshirt',
    materialType: 'Fabric',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 30.00,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'Digital printing on t-shirts - no minimum quantity'
  },

  // Binding Services
  {
    name: 'Spiral Binding',
    category: 'Binding',
    jobType: 'binding',
    materialType: 'Plastic',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 5.00,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'Spiral binding service for documents'
  },
  {
    name: 'Perfect Binding',
    category: 'Binding',
    jobType: 'binding',
    materialType: 'Paper',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 8.00,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'Perfect binding for books and booklets'
  },
  {
    name: 'Stapling Service',
    category: 'Binding',
    jobType: 'binding',
    materialType: 'Metal',
    pricingMethod: 'unit',
    basePrice: 0,
    pricePerUnit: 0.50,
    minimumQuantity: 1,
    setupFee: 0,
    isActive: true,
    description: 'Stapling service for documents'
  },

  // Letterhead & Stationery
  {
    name: 'Letterhead Printing',
    category: 'Stationery',
    jobType: 'letterhead',
    paperType: 'Bond',
    paperSize: '8.5x11',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 80.00,
    pricePerUnit: 0.20,
    minimumQuantity: 100,
    setupFee: 40.00,
    discountTiers: [
      { minQuantity: 500, maxQuantity: null, discountPercent: 10 }
    ],
    isActive: true,
    description: 'Professional letterhead printing'
  },
  {
    name: 'Envelope Printing',
    category: 'Stationery',
    jobType: 'envelope',
    paperType: 'Bond',
    materialType: 'Paper',
    colorType: 'color',
    pricingMethod: 'unit',
    basePrice: 60.00,
    pricePerUnit: 0.15,
    minimumQuantity: 100,
    setupFee: 30.00,
    isActive: true,
    description: 'Envelope printing service'
  }
];

async function seedPricing(tenantId = null) {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    let tenants = [];

    if (tenantId) {
      // Seed for specific tenant
      const tenant = await Tenant.findByPk(tenantId);
      if (!tenant) {
        console.error(`❌ Tenant with ID ${tenantId} not found.`);
        process.exit(1);
      }
      tenants = [tenant];
      console.log(`📦 Seeding pricing for tenant: ${tenant.name}`);
    } else {
      // Seed for all tenants
      tenants = await Tenant.findAll();
      if (tenants.length === 0) {
        console.error('❌ No tenants found. Please create a tenant first.');
        process.exit(1);
      }
      console.log(`📦 Seeding pricing for ${tenants.length} tenant(s)...`);
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const tenant of tenants) {
      console.log(`\n🏢 Processing tenant: ${tenant.name} (${tenant.id})`);

      for (const templateData of pricingTemplates) {
        // Check if template already exists for this tenant
        const existing = await PricingTemplate.findOne({
          where: {
            tenantId: tenant.id,
            name: templateData.name,
            category: templateData.category
          }
        });

        if (existing) {
          console.log(`  ⏭️  Skipped: ${templateData.name} (already exists)`);
          totalSkipped++;
          continue;
        }

        // Create pricing template
        await PricingTemplate.create({
          ...templateData,
          tenantId: tenant.id
        });

        console.log(`  ✅ Created: ${templateData.name}`);
        totalCreated++;
      }
    }

    console.log(`\n🎉 Seeding complete!`);
    console.log(`   Created: ${totalCreated} pricing templates`);
    console.log(`   Skipped: ${totalSkipped} (already exist)`);
    console.log(`   Total: ${totalCreated + totalSkipped} templates processed`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Get tenant ID from command line argument if provided
const tenantId = process.argv[2] || null;

// Run seeder
if (require.main === module) {
  seedPricing(tenantId);
}

module.exports = { seedPricing, pricingTemplates };

