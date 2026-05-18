const { sequelize } = require('../config/database');

/**
 * Add performance indexes for frequently queried fields
 * These composite indexes will significantly improve query performance
 * for common query patterns involving tenantId, status, and date fields
 */
/** True if error is missing-relation (optional tables in some deployments). */
const isMissingRelation = (error) => {
  const msg = error?.message || error?.parent?.message || '';
  return typeof msg === 'string' && msg.includes('does not exist');
};

const addPerformanceIndexes = async () => {
  console.log('📊 Adding performance indexes...');

  try {
    // Do not wrap in a single Sequelize transaction: if CREATE INDEX fails on an
    // optional table (e.g. inventory_items renamed to materials), PostgreSQL
    // aborts the transaction and all later statements get 25P02. Each DDL here
    // is idempotent (IF NOT EXISTS) and runs in its own implicit transaction.

    // Jobs table indexes
    console.log('  ➡️  Creating indexes on jobs table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_status_created_idx 
      ON jobs("tenantId", status, "createdAt" DESC);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_status_dueDate_idx 
      ON jobs("tenantId", status, "dueDate" ASC);
    `);

    // Invoices table indexes
    console.log('  ➡️  Creating indexes on invoices table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_status_paidDate_idx 
      ON invoices("tenantId", status, "paidDate" DESC);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_status_balance_idx 
      ON invoices("tenantId", status, balance DESC) 
      WHERE balance > 0;
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_invoiceDate_idx 
      ON invoices("tenantId", "invoiceDate" DESC);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_dueDate_idx 
      ON invoices("tenantId", "dueDate" ASC);
    `);

    // Expenses table indexes
    console.log('  ➡️  Creating indexes on expenses table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_expenseDate_idx 
      ON expenses("tenantId", "expenseDate" DESC);
    `);

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_status_expenseDate_idx 
      ON expenses("tenantId", status, "expenseDate" DESC);
    `);

    // Customers table indexes
    console.log('  ➡️  Creating indexes on customers table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_tenant_active_created_idx 
      ON customers("tenantId", "isActive", "createdAt" DESC);
    `);

    // Sales table indexes (for shop/pharmacy)
    console.log('  ➡️  Creating indexes on sales table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS sales_tenant_status_created_idx 
        ON sales("tenantId", status, "createdAt" DESC);
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS sales_tenant_status_completed_idx 
        ON sales("tenantId", status, "createdAt" DESC) 
        WHERE status = 'completed';
      `);
    } catch (error) {
      if (isMissingRelation(error)) {
        console.log('  ⚠️  Sales table does not exist, skipping sales indexes');
      } else {
        throw error;
      }
    }

    // Inventory items indexes (legacy name; may not exist after materials rename)
    console.log('  ➡️  Creating indexes on inventory_items table...');
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_tenant_active_idx 
        ON inventory_items("tenantId", "isActive");
      `);

      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS inventory_items_tenant_quantity_idx 
        ON inventory_items("tenantId", "quantityOnHand", "reorderLevel");
      `);
    } catch (error) {
      if (isMissingRelation(error)) {
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
      `);
    } catch (error) {
      if (isMissingRelation(error)) {
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
      `);
    } catch (error) {
      if (isMissingRelation(error)) {
        console.log('  ⚠️  Leads table does not exist, skipping leads indexes');
      } else {
        throw error;
      }
    }

    console.log('✅ Performance indexes created successfully');
  } catch (error) {
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
