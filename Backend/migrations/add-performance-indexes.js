const { sequelize } = require('../config/database');

/**
 * Add performance indexes for frequently queried fields
 * These composite indexes will significantly improve query performance
 * for common query patterns involving tenantId, status, and date fields
 */
const addPerformanceIndexes = async () => {
  console.log('📊 Adding performance indexes...');
  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Jobs table indexes
    console.log('  ➡️  Creating indexes on jobs table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_status_created_idx 
      ON jobs("tenantId", status, "createdAt" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_status_dueDate_idx 
      ON jobs("tenantId", status, "dueDate" ASC);
    `, { transaction });

    // Invoices table indexes
    console.log('  ➡️  Creating indexes on invoices table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_status_paidDate_idx 
      ON invoices("tenantId", status, "paidDate" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_status_balance_idx 
      ON invoices("tenantId", status, balance DESC) 
      WHERE balance > 0;
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_invoiceDate_idx 
      ON invoices("tenantId", "invoiceDate" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_dueDate_idx 
      ON invoices("tenantId", "dueDate" ASC);
    `, { transaction });

    // Expenses table indexes
    console.log('  ➡️  Creating indexes on expenses table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_expenseDate_idx 
      ON expenses("tenantId", "expenseDate" DESC);
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_status_expenseDate_idx 
      ON expenses("tenantId", status, "expenseDate" DESC);
    `, { transaction });

    // Customers table indexes
    console.log('  ➡️  Creating indexes on customers table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_tenant_active_created_idx 
      ON customers("tenantId", "isActive", "createdAt" DESC);
    `, { transaction });

    // Sales table indexes (for shop/pharmacy)
    console.log('  ➡️  Creating indexes on sales table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS sales_tenant_status_created_idx 
        ON sales("tenantId", status, "createdAt" DESC);
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS sales_tenant_status_completed_idx 
        ON sales("tenantId", status, "createdAt" DESC) 
        WHERE status = 'completed';
      `, { transaction });
    } catch (error) {
      // Sales table might not exist for all business types
      if (error.message && error.message.includes('does not exist')) {
        console.log('  ⚠️  Sales table does not exist, skipping sales indexes');
      } else {
        throw error;
      }
    }

    // Inventory items indexes
    console.log('  ➡️  Creating indexes on inventory_items table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_tenant_active_idx 
        ON inventory_items("tenantId", "isActive");
      `, { transaction });

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_tenant_quantity_idx 
        ON inventory_items("tenantId", "quantityOnHand", "reorderLevel");
      `, { transaction });
    } catch (error) {
      // Inventory table might not exist for all business types
      if (error.message && error.message.includes('does not exist')) {
        console.log('  ⚠️  Inventory_items table does not exist, skipping inventory indexes');
      } else {
        throw error;
      }
    }

    // Quotes table indexes (list ordering: tenantId + createdAt DESC)
    console.log('  ➡️  Creating indexes on quotes table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS quotes_tenant_created_idx 
        ON quotes("tenantId", "createdAt" DESC);
      `, { transaction });
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.log('  ⚠️  Quotes table does not exist, skipping quotes indexes');
      } else {
        throw error;
      }
    }

    // Leads table indexes (list ordering: tenantId + createdAt DESC; existing status/assigned/followup in create-leads-tables)
    console.log('  ➡️  Creating indexes on leads table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS leads_tenant_created_idx 
        ON leads("tenantId", "createdAt" DESC);
      `, { transaction });
    } catch (error) {
      if (error.message && error.message.includes('does not exist')) {
        console.log('  ⚠️  Leads table does not exist, skipping leads indexes');
      } else {
        throw error;
      }
    }

    await transaction.commit();
    console.log('✅ Performance indexes created successfully');
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('❌ Error creating performance indexes:', error);
    throw error;
  }
};

// Run migration if called directly
if (require.main === module) {
  addPerformanceIndexes()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = addPerformanceIndexes;
