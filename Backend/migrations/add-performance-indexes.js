const { sequelize } = require('../config/database');

/**
 * Migration: Add performance indexes for frequently queried fields
 * 
 * This migration adds indexes to improve query performance for:
 * - tenantId (most queries filter by tenant)
 * - status (frequently filtered by status)
 * - createdAt (frequently sorted by creation date)
 * - Composite indexes for common query patterns
 */
const addPerformanceIndexes = async () => {
  console.log('🚀 Starting performance indexes migration...');
  const transaction = await sequelize.transaction();

  try {
    // Indexes for Jobs table
    console.log('📊 Creating indexes for jobs table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_status_idx ON jobs("tenantId", status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_tenant_created_idx ON jobs("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS jobs_customer_idx ON jobs("customerId");
    `, { transaction });

    // Indexes for Invoices table
    console.log('📊 Creating indexes for invoices table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_status_idx ON invoices("tenantId", status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_tenant_created_idx ON invoices("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices("customerId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices("dueDate");
    `, { transaction });

    // Indexes for Expenses table
    console.log('📊 Creating indexes for expenses table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_status_idx ON expenses("tenantId", status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_tenant_created_idx ON expenses("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_status_idx ON expenses(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_approval_status_idx ON expenses("approvalStatus");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_job_idx ON expenses("jobId");
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses("expenseDate");
    `, { transaction });

    // Indexes for Quotes table
    console.log('📊 Creating indexes for quotes table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quotes_tenant_status_idx ON quotes("tenantId", status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quotes_tenant_created_idx ON quotes("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS quotes_customer_idx ON quotes("customerId");
    `, { transaction });

    // Indexes for Customers table
    console.log('📊 Creating indexes for customers table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_tenant_created_idx ON customers("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS customers_active_idx ON customers("isActive");
    `, { transaction });

    // Indexes for Vendors table
    console.log('📊 Creating indexes for vendors table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS vendors_tenant_created_idx ON vendors("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS vendors_active_idx ON vendors("isActive");
    `, { transaction });

    // Indexes for Leads table
    console.log('📊 Creating indexes for leads table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_tenant_status_idx ON leads("tenantId", status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_tenant_created_idx ON leads("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_status_idx ON leads(status);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS leads_priority_idx ON leads(priority);
    `, { transaction });

    // Indexes for Employees table
    console.log('📊 Creating indexes for employees table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS employees_tenant_created_idx ON employees("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);
    `, { transaction });

    // Indexes for Inventory Items table
    console.log('📊 Creating indexes for inventory_items table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_items_tenant_created_idx ON inventory_items("tenantId", "createdAt" DESC);
    `, { transaction });
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS inventory_items_active_idx ON inventory_items("isActive");
    `, { transaction });

    // Indexes for Sales table (for shop/pharmacy)
    console.log('📊 Creating indexes for sales table...');
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_tenant_created_idx ON sales("tenantId", "createdAt" DESC);
    `, { transaction }).catch(() => {
      // Table might not exist yet, ignore error
      console.log('⚠️  Sales table not found, skipping indexes');
    });

    await transaction.commit();
    console.log('✅ Performance indexes migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Performance indexes migration failed:', error);
    throw error;
  }
};

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
