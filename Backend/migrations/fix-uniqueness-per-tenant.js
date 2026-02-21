/**
 * Migration: Change global unique constraints to per-tenant
 * - Customer, Vendor, Lead, Employee: email and phone unique per tenant (not globally)
 * - Invoice: invoiceNumber unique per tenant
 * - Quote: quoteNumber unique per tenant
 * - Barcode: barcode unique per tenant
 * - InventoryItem: sku unique per tenant
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { sequelize } = require('../config/database');

const tryUniqueIndex = async (name, sql) => {
  try {
    await sequelize.query(sql);
    return true;
  } catch (e) {
    if (e.code === '23505' || e.parent?.code === '23505' || e.message?.includes('duplicate key') || e.name === 'SequelizeUniqueConstraintError') {
      console.warn(`  ⚠️  Skipped ${name}: duplicate values exist per tenant. Resolve duplicates and re-run to enforce.`);
      return false;
    }
    throw e;
  }
};

const dropIndexIfExists = async (indexName) => {
  try {
    await sequelize.query(`DROP INDEX IF EXISTS "${indexName}";`);
  } catch (e) {
    if (!e.message?.includes('does not exist')) throw e;
  }
};

const fixUniquenessPerTenant = async () => {
  console.log('🔄 Fixing uniqueness constraints to be per-tenant...\n');

  try {
    // ========== 1. Customer, Vendor, Lead, Employee: Email and Phone ==========
    console.log('  ➡️  Replacing global email/phone indexes with per-tenant...');

    const globalIndexes = [
      'idx_customers_email_unique',
      'idx_customers_phone_unique',
      'idx_vendors_email_unique',
      'idx_vendors_phone_unique',
      'idx_leads_email_unique',
      'idx_leads_phone_unique',
      'idx_employees_email_unique',
      'idx_employees_phone_unique'
    ];

    for (const idx of globalIndexes) {
      await dropIndexIfExists(idx);
    }

    // Customers - per-tenant email and phone
    await tryUniqueIndex('customers_email_per_tenant', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_email_unique
      ON customers ("tenantId", LOWER(TRIM(email)))
      WHERE email IS NOT NULL AND TRIM(email) != '';
    `);
    await tryUniqueIndex('customers_phone_per_tenant', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_tenant_phone_unique
      ON customers ("tenantId", TRIM(phone))
      WHERE phone IS NOT NULL AND TRIM(phone) != '';
    `);

    // Vendors
    try {
      await tryUniqueIndex('vendors_email_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_tenant_email_unique
        ON vendors ("tenantId", LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('vendors_phone_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_tenant_phone_unique
        ON vendors ("tenantId", TRIM(phone))
        WHERE phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Leads - partial index (tenantId can be NULL for admin leads)
    try {
      await tryUniqueIndex('leads_email_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tenant_email_unique
        ON leads ("tenantId", LOWER(TRIM(email)))
        WHERE "tenantId" IS NOT NULL AND email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('leads_phone_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_tenant_phone_unique
        ON leads ("tenantId", TRIM(phone))
        WHERE "tenantId" IS NOT NULL AND phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Employees
    try {
      await tryUniqueIndex('employees_email_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tenant_email_unique
        ON employees ("tenantId", LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('employees_phone_per_tenant', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_tenant_phone_unique
        ON employees ("tenantId", TRIM(phone))
        WHERE phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // ========== 2. Invoice: invoiceNumber per tenant ==========
    console.log('  ➡️  Fixing invoice invoiceNumber to be per-tenant...');
    try {
      const [invConstraints] = await sequelize.query(`
        SELECT c.conname AS constraint_name,
               array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
        WHERE t.relname = 'invoices' AND n.nspname = 'public' AND c.contype = 'u'
        GROUP BY c.conname, c.conkey
      `);
      const invNumberConstraints = invConstraints.filter((r) => {
        const cols = Array.isArray(r.columns) ? r.columns : (r.columns || '').replace(/^\{|\}$/g, '').split(',');
        return cols.length === 1 && (cols[0] === 'invoiceNumber' || cols[0] === 'invoice_number');
      });
      for (const row of invNumberConstraints) {
        await sequelize.query(`ALTER TABLE invoices DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`);
        console.log(`     Dropped ${row.constraint_name}`);
      }

      await tryUniqueIndex('invoices_tenant_invoiceNumber', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_tenant_invoice_number
        ON invoices ("tenantId", "invoiceNumber");
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist') && !e.message?.includes('relation "invoices" does not exist')) throw e;
      console.log('     ℹ️  Invoices table or constraint not found, skipping');
    }

    // ========== 3. Quote: quoteNumber per tenant ==========
    console.log('  ➡️  Fixing quote quoteNumber to be per-tenant...');
    try {
      const [quoConstraints] = await sequelize.query(`
        SELECT c.conname AS constraint_name,
               array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
        WHERE t.relname = 'quotes' AND n.nspname = 'public' AND c.contype = 'u'
        GROUP BY c.conname, c.conkey
      `);
      const quoNumberConstraints = quoConstraints.filter((r) => {
        const cols = Array.isArray(r.columns) ? r.columns : (r.columns || '').replace(/^\{|\}$/g, '').split(',');
        return cols.length === 1 && (cols[0] === 'quoteNumber' || cols[0] === 'quote_number');
      });
      for (const row of quoNumberConstraints) {
        await sequelize.query(`ALTER TABLE quotes DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`);
        console.log(`     Dropped ${row.constraint_name}`);
      }

      await tryUniqueIndex('quotes_tenant_quoteNumber', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_quotes_tenant_quote_number
        ON quotes ("tenantId", "quoteNumber");
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist') && !e.message?.includes('relation "quotes" does not exist')) throw e;
      console.log('     ℹ️  Quotes table or constraint not found, skipping');
    }

    // ========== 4. Barcode: barcode per tenant ==========
    console.log('  ➡️  Fixing barcode to be per-tenant...');
    try {
      const [barcodeConstraints] = await sequelize.query(`
        SELECT c.conname AS constraint_name,
               array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
        WHERE t.relname = 'barcodes' AND n.nspname = 'public' AND c.contype = 'u'
        GROUP BY c.conname, c.conkey
      `);
      const barcodeColConstraints = (barcodeConstraints || []).filter((r) => {
        const cols = Array.isArray(r.columns) ? r.columns : (r.columns || '').replace(/^\{|\}$/g, '').split(',');
        return cols.length === 1 && cols[0] === 'barcode';
      });
      for (const row of barcodeColConstraints) {
        await sequelize.query(`ALTER TABLE barcodes DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`);
        console.log(`     Dropped ${row.constraint_name}`);
      }

      await tryUniqueIndex('barcodes_tenant_barcode', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_barcodes_tenant_barcode
        ON barcodes ("tenantId", barcode);
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist') && !e.message?.includes('relation "barcodes" does not exist')) throw e;
      console.log('     ℹ️  Barcodes table not found, skipping');
    }

    // ========== 5. InventoryItem: sku per tenant ==========
    console.log('  ➡️  Fixing inventory_items sku to be per-tenant...');
    try {
      const [invItemConstraints] = await sequelize.query(`
        SELECT c.conname AS constraint_name,
               array_agg(a.attname ORDER BY array_position(c.conkey, a.attnum)) AS columns
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey) AND NOT a.attisdropped
        WHERE t.relname = 'inventory_items' AND n.nspname = 'public' AND c.contype = 'u'
        GROUP BY c.conname, c.conkey
      `);
      const skuConstraints = (invItemConstraints || []).filter((r) => {
        const cols = Array.isArray(r.columns) ? r.columns : (r.columns || '').replace(/^\{|\}$/g, '').split(',');
        return cols.length === 1 && cols[0] === 'sku';
      });
      for (const row of skuConstraints) {
        await sequelize.query(`ALTER TABLE inventory_items DROP CONSTRAINT IF EXISTS "${row.constraint_name}";`);
        console.log(`     Dropped ${row.constraint_name}`);
      }

      await tryUniqueIndex('inventory_items_tenant_sku', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_tenant_sku
        ON inventory_items ("tenantId", sku)
        WHERE sku IS NOT NULL AND TRIM(sku) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist') && !e.message?.includes('relation "inventory_items" does not exist')) throw e;
      console.log('     ℹ️  Inventory_items table not found, skipping');
    }

    console.log('\n✅ Uniqueness constraints are now per-tenant.');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
};

if (require.main === module) {
  fixUniquenessPerTenant()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = fixUniquenessPerTenant;
