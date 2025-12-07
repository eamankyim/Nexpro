require('dotenv').config();
const { sequelize } = require('../config/database');
const { InventoryCategory, InventoryItem, InventoryMovement, Vendor, Job, UserTenant, User } = require('../models');

// Common inventory items for a printing business
const inventoryItems = [
  // Paper & Materials
  { name: 'A4 White Paper 80gsm', unit: 'ream', category: 'Paper & Materials', unitCost: 25.00, quantity: 150, reorderLevel: 30, location: 'Storage Room A' },
  { name: 'A4 Colored Paper Set', unit: 'pack', category: 'Paper & Materials', unitCost: 45.00, quantity: 80, reorderLevel: 20, location: 'Storage Room A' },
  { name: 'A3 White Paper 120gsm', unit: 'ream', category: 'Paper & Materials', unitCost: 35.00, quantity: 60, reorderLevel: 15, location: 'Storage Room A' },
  { name: 'Photo Paper Glossy', unit: 'pack', category: 'Paper & Materials', unitCost: 55.00, quantity: 40, reorderLevel: 10, location: 'Storage Room A' },
  { name: 'Card Stock 250gsm', unit: 'pack', category: 'Paper & Materials', unitCost: 65.00, quantity: 50, reorderLevel: 12, location: 'Storage Room A' },
  { name: 'Bond Paper 70gsm', unit: 'ream', category: 'Paper & Materials', unitCost: 20.00, quantity: 200, reorderLevel: 50, location: 'Storage Room A' },
  
  // Ink & Toner
  { name: 'Black Ink Cartridge', unit: 'pcs', category: 'Ink & Toner', unitCost: 45.00, quantity: 25, reorderLevel: 5, location: 'Storage Room B' },
  { name: 'Color Ink Cartridge Set', unit: 'set', category: 'Ink & Toner', unitCost: 120.00, quantity: 15, reorderLevel: 3, location: 'Storage Room B' },
  { name: 'Toner Cartridge Black', unit: 'pcs', category: 'Ink & Toner', unitCost: 85.00, quantity: 20, reorderLevel: 4, location: 'Storage Room B' },
  { name: 'Toner Cartridge Color', unit: 'set', category: 'Ink & Toner', unitCost: 250.00, quantity: 8, reorderLevel: 2, location: 'Storage Room B' },
  { name: 'Ink Refill Kit', unit: 'kit', category: 'Ink & Toner', unitCost: 30.00, quantity: 30, reorderLevel: 8, location: 'Storage Room B' },
  
  // Binding & Finishing
  { name: 'Spiral Binding Coils', unit: 'pcs', category: 'Binding & Finishing', unitCost: 2.50, quantity: 500, reorderLevel: 100, location: 'Storage Room C' },
  { name: 'Staples Box', unit: 'box', category: 'Binding & Finishing', unitCost: 8.00, quantity: 40, reorderLevel: 10, location: 'Storage Room C' },
  { name: 'Binding Covers', unit: 'pcs', category: 'Binding & Finishing', unitCost: 5.00, quantity: 200, reorderLevel: 50, location: 'Storage Room C' },
  { name: 'Lamination Sheets A4', unit: 'pack', category: 'Binding & Finishing', unitCost: 35.00, quantity: 60, reorderLevel: 15, location: 'Storage Room C' },
  { name: 'Lamination Sheets A3', unit: 'pack', category: 'Binding & Finishing', unitCost: 55.00, quantity: 30, reorderLevel: 8, location: 'Storage Room C' },
  { name: 'Corner Rounders', unit: 'pcs', category: 'Binding & Finishing', unitCost: 15.00, quantity: 10, reorderLevel: 2, location: 'Storage Room C' },
  
  // Large Format Materials
  { name: 'Vinyl Roll 54"', unit: 'roll', category: 'Large Format Materials', unitCost: 180.00, quantity: 12, reorderLevel: 3, location: 'Storage Room D' },
  { name: 'Banner Material', unit: 'roll', category: 'Large Format Materials', unitCost: 150.00, quantity: 15, reorderLevel: 4, location: 'Storage Room D' },
  { name: 'One Way Vision Film', unit: 'roll', category: 'Large Format Materials', unitCost: 220.00, quantity: 8, reorderLevel: 2, location: 'Storage Room D' },
  { name: 'Mounting Foam Board', unit: 'sheet', category: 'Large Format Materials', unitCost: 25.00, quantity: 100, reorderLevel: 25, location: 'Storage Room D' },
  { name: 'Canvas Material', unit: 'roll', category: 'Large Format Materials', unitCost: 200.00, quantity: 10, reorderLevel: 3, location: 'Storage Room D' },
  
  // Office Supplies
  { name: 'Paper Clips', unit: 'box', category: 'Office Supplies', unitCost: 3.00, quantity: 50, reorderLevel: 15, location: 'Office' },
  { name: 'Rubber Bands', unit: 'pack', category: 'Office Supplies', unitCost: 2.50, quantity: 40, reorderLevel: 10, location: 'Office' },
  { name: 'File Folders', unit: 'pack', category: 'Office Supplies', unitCost: 12.00, quantity: 30, reorderLevel: 8, location: 'Office' },
  { name: 'Envelopes A4', unit: 'pack', category: 'Office Supplies', unitCost: 8.00, quantity: 60, reorderLevel: 20, location: 'Office' },
  { name: 'Tape Dispensers', unit: 'pcs', category: 'Office Supplies', unitCost: 15.00, quantity: 12, reorderLevel: 3, location: 'Office' },
  
  // Maintenance & Equipment
  { name: 'Printer Cleaning Kit', unit: 'kit', category: 'Maintenance & Equipment', unitCost: 25.00, quantity: 8, reorderLevel: 2, location: 'Maintenance' },
  { name: 'Lubricating Oil', unit: 'bottle', category: 'Maintenance & Equipment', unitCost: 18.00, quantity: 15, reorderLevel: 5, location: 'Maintenance' },
  { name: 'Cleaning Cloths', unit: 'pack', category: 'Maintenance & Equipment', unitCost: 10.00, quantity: 25, reorderLevel: 8, location: 'Maintenance' },
];

function randomPick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min, max) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(2));
}

function generateSKU(name) {
  const prefix = name
    .split(' ')
    .map(word => word.substring(0, 3).toUpperCase())
    .join('');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${random}`;
}

async function seedInventory() {
  try {
    console.log('[Seed] Starting inventory seeding...');

    // Get tenant ID from first job or vendor
    const firstJob = await Job.findOne({ limit: 1 });
    if (!firstJob) {
      console.log('[Seed] No jobs found. Please create jobs first.');
      return;
    }

    const tenantId = firstJob.tenantId;
    console.log(`[Seed] Using tenant ID: ${tenantId}`);

    // Get vendors for preferred vendor assignment
    const vendors = await Vendor.findAll({
      where: { tenantId },
      limit: 10
    });

    // Get users for movement tracking
    const userTenants = await UserTenant.findAll({
      where: { tenantId, status: 'active' },
      include: [{ model: User, as: 'user' }],
      limit: 5
    });
    const users = userTenants.map(ut => ut.user).filter(Boolean);

    // Get some jobs for movement tracking
    const jobs = await Job.findAll({
      where: { tenantId },
      limit: 20,
      order: [['createdAt', 'DESC']]
    });

    // Step 1: Create inventory categories
    console.log('[Seed] Creating inventory categories...');
    const categoryMap = {};
    const uniqueCategories = [...new Set(inventoryItems.map(item => item.category))];

    for (const categoryName of uniqueCategories) {
      try {
        const [category, created] = await InventoryCategory.findOrCreate({
          where: { tenantId, name: categoryName },
          defaults: {
            tenantId,
            name: categoryName,
            description: `Category for ${categoryName.toLowerCase()}`,
            isActive: true
          }
        });
        categoryMap[categoryName] = category.id;
        if (created) {
          console.log(`[Seed] Created category: ${categoryName}`);
        }
      } catch (error) {
        console.error(`[Seed] Error creating category ${categoryName}:`, error.message);
      }
    }

    // Step 2: Create inventory items
    console.log('[Seed] Creating inventory items...');
    const createdItems = [];
    const existingSKUs = new Set();

    for (const itemData of inventoryItems) {
      try {
        // Generate unique SKU
        let sku;
        do {
          sku = generateSKU(itemData.name);
        } while (existingSKUs.has(sku));
        existingSKUs.add(sku);

        const categoryId = categoryMap[itemData.category];
        const preferredVendorId = vendors.length > 0 && Math.random() < 0.6 
          ? randomPick(vendors).id 
          : null;

        const item = await InventoryItem.create({
          tenantId,
          name: itemData.name,
          sku,
          description: `${itemData.name} - ${itemData.category}`,
          categoryId,
          unit: itemData.unit,
          quantityOnHand: itemData.quantity,
          reorderLevel: itemData.reorderLevel,
          preferredVendorId,
          unitCost: itemData.unitCost,
          location: itemData.location,
          isActive: true
        });

        createdItems.push({
          item,
          initialQuantity: itemData.quantity,
          unitCost: itemData.unitCost
        });

        console.log(`[Seed] Created item: ${itemData.name} (SKU: ${sku})`);
      } catch (error) {
        console.error(`[Seed] Error creating item ${itemData.name}:`, error.message);
      }
    }

    console.log(`[Seed] Created ${createdItems.length} inventory items`);

    // Step 3: Create inventory movements (purchases and usage)
    console.log('[Seed] Creating inventory movements...');
    let movementCount = 0;

    for (const { item, initialQuantity, unitCost } of createdItems) {
      // Create initial purchase movement to establish the quantity
      const purchaseDate = new Date();
      purchaseDate.setMonth(purchaseDate.getMonth() - randomInRange(1, 6)); // 1-6 months ago

      try {
        await InventoryMovement.create({
          tenantId,
          itemId: item.id,
          type: 'purchase',
          quantityDelta: initialQuantity,
          previousQuantity: 0,
          newQuantity: initialQuantity,
          unitCost: unitCost,
          reference: `INIT-${item.sku}`,
          notes: `Initial stock purchase for ${item.name}`,
          createdBy: users.length > 0 ? randomPick(users).id : null,
          occurredAt: purchaseDate,
          createdAt: purchaseDate,
          updatedAt: purchaseDate
        });
        movementCount++;

        // Create some usage movements (for jobs that used this item)
        if (jobs.length > 0 && Math.random() < 0.4) {
          const usageCount = randomInRange(1, 3);
          let currentQuantity = initialQuantity;

          for (let i = 0; i < usageCount; i++) {
            const usageDate = new Date(purchaseDate);
            usageDate.setDate(usageDate.getDate() + randomInRange(1, 90)); // Within 90 days of purchase

            if (usageDate > new Date()) continue; // Don't create future dates

            const usageQuantity = randomDecimal(1, Math.min(20, currentQuantity * 0.3));
            const newQty = Math.max(0, currentQuantity - usageQuantity);

            await InventoryMovement.create({
              tenantId,
              itemId: item.id,
              type: 'usage',
              quantityDelta: -usageQuantity,
              previousQuantity: currentQuantity,
              newQuantity: newQty,
              unitCost: unitCost,
              reference: randomPick(jobs).jobNumber,
              notes: `Used for job`,
              jobId: randomPick(jobs).id,
              createdBy: users.length > 0 ? randomPick(users).id : null,
              occurredAt: usageDate,
              createdAt: usageDate,
              updatedAt: usageDate
            });

            // Update item quantity
            await item.update({ quantityOnHand: newQty });
            currentQuantity = newQty;
            movementCount++;
          }
        }

        // Create some additional purchase movements (restocking)
        if (Math.random() < 0.3 && initialQuantity < 100) {
          const restockDate = new Date();
          restockDate.setMonth(restockDate.getMonth() - randomInRange(0, 3));

          const restockQuantity = randomInRange(20, 50);
          const currentQty = parseFloat(item.quantityOnHand);

          await InventoryMovement.create({
            tenantId,
            itemId: item.id,
            type: 'purchase',
            quantityDelta: restockQuantity,
            previousQuantity: currentQty,
            newQuantity: currentQty + restockQuantity,
            unitCost: unitCost * (0.95 + Math.random() * 0.1), // Slight price variation
            reference: `RESTOCK-${item.sku}`,
            notes: `Restocking ${item.name}`,
            createdBy: users.length > 0 ? randomPick(users).id : null,
            occurredAt: restockDate,
            createdAt: restockDate,
            updatedAt: restockDate
          });

          await item.update({ quantityOnHand: currentQty + restockQuantity });
          movementCount++;
        }
      } catch (error) {
        console.error(`[Seed] Error creating movements for ${item.name}:`, error.message);
      }
    }

    console.log(`[Seed] ✅ Created ${movementCount} inventory movements`);
    console.log(`[Seed] ✅ Created ${createdItems.length} inventory items`);
    console.log(`[Seed] ✅ Created ${uniqueCategories.length} inventory categories`);
    console.log('[Seed] ✅ Inventory seeding completed successfully!');

  } catch (error) {
    console.error('[Seed] ❌ Error seeding inventory:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the seeder
if (require.main === module) {
  seedInventory()
    .then(() => {
      console.log('[Seed] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Seed] Script failed:', error);
      process.exit(1);
    });
}

module.exports = seedInventory;


