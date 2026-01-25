const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const createShopPharmacyTables = async () => {
  console.log('🚀 Starting shop and pharmacy tables migration...');
  const transaction = await sequelize.transaction();

  try {
    console.log('🔐 Ensuring pgcrypto extension is available...');
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`, { transaction });

    // ============================================
    // SHOP MANAGEMENT TABLES
    // ============================================

    console.log('🏪 Creating shops table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS shops (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Ghana',
        "postalCode" VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(255),
        "managerName" VARCHAR(255),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT shops_tenant_code_unique UNIQUE ("tenantId", code)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS shops_tenant_idx ON shops("tenantId");
    `, { transaction });

    console.log('📦 Creating products table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        barcode VARCHAR(100),
        description TEXT,
        "categoryId" UUID REFERENCES inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "costPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "sellingPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "quantityOnHand" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "reorderLevel" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "reorderQuantity" NUMERIC(12,2) NOT NULL DEFAULT 0,
        unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
        brand VARCHAR(255),
        supplier VARCHAR(255),
        "hasVariants" BOOLEAN NOT NULL DEFAULT false,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT products_tenant_sku_unique UNIQUE ("tenantId", sku)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_tenant_idx ON products("tenantId");
      CREATE INDEX IF NOT EXISTS products_shop_idx ON products("shopId");
      CREATE INDEX IF NOT EXISTS products_category_idx ON products("categoryId");
      CREATE INDEX IF NOT EXISTS products_barcode_idx ON products(barcode);
    `, { transaction });

    console.log('🛒 Creating sales table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sales_payment_method') THEN
          CREATE TYPE enum_sales_payment_method AS ENUM ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'other');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_sales_status') THEN
          CREATE TYPE enum_sales_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "shopId" UUID REFERENCES shops(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "saleNumber" VARCHAR(100) NOT NULL,
        "customerId" UUID REFERENCES customers(id) ON UPDATE CASCADE ON DELETE SET NULL,
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax NUMERIC(12,2) NOT NULL DEFAULT 0,
        total NUMERIC(12,2) NOT NULL DEFAULT 0,
        "paymentMethod" enum_sales_payment_method NOT NULL DEFAULT 'cash',
        "amountPaid" NUMERIC(12,2) NOT NULL DEFAULT 0,
        change NUMERIC(12,2) NOT NULL DEFAULT 0,
        status enum_sales_status NOT NULL DEFAULT 'completed',
        "invoiceId" UUID REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "soldBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sales_tenant_idx ON sales("tenantId");
      CREATE INDEX IF NOT EXISTS sales_shop_idx ON sales("shopId");
      CREATE INDEX IF NOT EXISTS sales_customer_idx ON sales("customerId");
      CREATE INDEX IF NOT EXISTS sales_number_idx ON sales("saleNumber");
      CREATE INDEX IF NOT EXISTS sales_status_idx ON sales(status);
      CREATE INDEX IF NOT EXISTS sales_created_idx ON sales("createdAt");
    `, { transaction });

    console.log('🎨 Creating product_variants table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS product_variants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "productId" UUID NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        barcode VARCHAR(100),
        "costPrice" NUMERIC(12,2),
        "sellingPrice" NUMERIC(12,2),
        "quantityOnHand" NUMERIC(12,2) NOT NULL DEFAULT 0,
        attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT product_variants_product_sku_unique UNIQUE ("productId", sku)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS product_variants_product_idx ON product_variants("productId");
      CREATE INDEX IF NOT EXISTS product_variants_barcode_idx ON product_variants(barcode);
    `, { transaction });

    console.log('📋 Creating sale_items table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "saleId" UUID NOT NULL REFERENCES sales(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productId" UUID NOT NULL REFERENCES products(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "productVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(100),
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
        "unitPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        discount NUMERIC(12,2) NOT NULL DEFAULT 0,
        tax NUMERIC(12,2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
        total NUMERIC(12,2) NOT NULL DEFAULT 0,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON sale_items("saleId");
      CREATE INDEX IF NOT EXISTS sale_items_product_idx ON sale_items("productId");
    `, { transaction });

    console.log('📊 Creating barcodes table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_barcodes_barcode_type') THEN
          CREATE TYPE enum_barcodes_barcode_type AS ENUM ('EAN13', 'EAN8', 'UPC', 'CODE128', 'CODE39', 'QR', 'other');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS barcodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productId" UUID REFERENCES products(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "productVariantId" UUID REFERENCES product_variants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        barcode VARCHAR(255) NOT NULL UNIQUE,
        "barcodeType" enum_barcodes_barcode_type NOT NULL DEFAULT 'EAN13',
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS barcodes_tenant_idx ON barcodes("tenantId");
      CREATE INDEX IF NOT EXISTS barcodes_product_idx ON barcodes("productId");
      CREATE INDEX IF NOT EXISTS barcodes_variant_idx ON barcodes("productVariantId");
    `, { transaction });

    // ============================================
    // PHARMACY MANAGEMENT TABLES
    // ============================================

    console.log('💊 Creating pharmacies table...');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS pharmacies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Ghana',
        "postalCode" VARCHAR(20),
        phone VARCHAR(50),
        email VARCHAR(255),
        "pharmacistName" VARCHAR(255),
        "licenseNumber" VARCHAR(255),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT pharmacies_tenant_code_unique UNIQUE ("tenantId", code)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS pharmacies_tenant_idx ON pharmacies("tenantId");
    `, { transaction });

    console.log('💉 Creating drugs table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_drugs_drug_type') THEN
          CREATE TYPE enum_drugs_drug_type AS ENUM ('prescription', 'otc', 'controlled', 'herbal', 'supplement');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_drugs_schedule') THEN
          CREATE TYPE enum_drugs_schedule AS ENUM ('I', 'II', 'III', 'IV', 'V', 'N/A');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS drugs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "pharmacyId" UUID REFERENCES pharmacies(id) ON UPDATE CASCADE ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        "genericName" VARCHAR(255),
        "brandName" VARCHAR(255),
        sku VARCHAR(100),
        barcode VARCHAR(100),
        description TEXT,
        "categoryId" UUID REFERENCES inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "drugType" enum_drugs_drug_type NOT NULL DEFAULT 'otc',
        schedule enum_drugs_schedule,
        "costPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "sellingPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "quantityOnHand" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "reorderLevel" NUMERIC(12,2) NOT NULL DEFAULT 0,
        unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
        strength VARCHAR(100),
        form VARCHAR(100),
        manufacturer VARCHAR(255),
        supplier VARCHAR(255),
        "expiryDate" DATE,
        "batchNumber" VARCHAR(100),
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT drugs_tenant_sku_unique UNIQUE ("tenantId", sku)
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS drugs_tenant_idx ON drugs("tenantId");
      CREATE INDEX IF NOT EXISTS drugs_pharmacy_idx ON drugs("pharmacyId");
      CREATE INDEX IF NOT EXISTS drugs_category_idx ON drugs("categoryId");
      CREATE INDEX IF NOT EXISTS drugs_type_idx ON drugs("drugType");
      CREATE INDEX IF NOT EXISTS drugs_barcode_idx ON drugs(barcode);
      CREATE INDEX IF NOT EXISTS drugs_expiry_idx ON drugs("expiryDate");
    `, { transaction });

    console.log('📝 Creating prescriptions table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_prescriptions_status') THEN
          CREATE TYPE enum_prescriptions_status AS ENUM ('pending', 'filled', 'partially_filled', 'cancelled', 'expired');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "pharmacyId" UUID REFERENCES pharmacies(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "prescriptionNumber" VARCHAR(100) NOT NULL,
        "customerId" UUID NOT NULL REFERENCES customers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "prescriberName" VARCHAR(255) NOT NULL,
        "prescriberLicense" VARCHAR(255),
        "prescriberPhone" VARCHAR(50),
        "prescriptionDate" DATE NOT NULL,
        "expiryDate" DATE,
        status enum_prescriptions_status NOT NULL DEFAULT 'pending',
        "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "amountPaid" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "invoiceId" UUID REFERENCES invoices(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "filledBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "filledAt" TIMESTAMPTZ,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS prescriptions_tenant_idx ON prescriptions("tenantId");
      CREATE INDEX IF NOT EXISTS prescriptions_pharmacy_idx ON prescriptions("pharmacyId");
      CREATE INDEX IF NOT EXISTS prescriptions_customer_idx ON prescriptions("customerId");
      CREATE INDEX IF NOT EXISTS prescriptions_number_idx ON prescriptions("prescriptionNumber");
      CREATE INDEX IF NOT EXISTS prescriptions_status_idx ON prescriptions(status);
      CREATE INDEX IF NOT EXISTS prescriptions_date_idx ON prescriptions("prescriptionDate");
    `, { transaction });

    console.log('💊 Creating prescription_items table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_prescription_items_status') THEN
          CREATE TYPE enum_prescription_items_status AS ENUM ('pending', 'filled', 'partially_filled', 'unavailable', 'cancelled');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS prescription_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "prescriptionId" UUID NOT NULL REFERENCES prescriptions(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "drugId" UUID NOT NULL REFERENCES drugs(id) ON UPDATE CASCADE ON DELETE RESTRICT,
        "drugName" VARCHAR(255) NOT NULL,
        strength VARCHAR(100),
        form VARCHAR(100),
        quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
        "quantityFilled" NUMERIC(12,2) NOT NULL DEFAULT 0,
        unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
        dosage VARCHAR(255),
        duration VARCHAR(255),
        instructions TEXT,
        "unitPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        "totalPrice" NUMERIC(12,2) NOT NULL DEFAULT 0,
        status enum_prescription_items_status NOT NULL DEFAULT 'pending',
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS prescription_items_prescription_idx ON prescription_items("prescriptionId");
      CREATE INDEX IF NOT EXISTS prescription_items_drug_idx ON prescription_items("drugId");
      CREATE INDEX IF NOT EXISTS prescription_items_status_idx ON prescription_items(status);
    `, { transaction });

    console.log('⚠️ Creating drug_interactions table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_drug_interactions_interaction_type') THEN
          CREATE TYPE enum_drug_interactions_interaction_type AS ENUM ('major', 'moderate', 'minor', 'unknown');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_drug_interactions_severity') THEN
          CREATE TYPE enum_drug_interactions_severity AS ENUM ('severe', 'moderate', 'mild', 'none');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS drug_interactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "drug1Id" UUID NOT NULL REFERENCES drugs(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "drug2Id" UUID NOT NULL REFERENCES drugs(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "interactionType" enum_drug_interactions_interaction_type NOT NULL DEFAULT 'unknown',
        severity enum_drug_interactions_severity NOT NULL DEFAULT 'none',
        description TEXT,
        "clinicalSignificance" TEXT,
        management TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT drug_interactions_drugs_unique UNIQUE ("drug1Id", "drug2Id")
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS drug_interactions_tenant_idx ON drug_interactions("tenantId");
      CREATE INDEX IF NOT EXISTS drug_interactions_drug1_idx ON drug_interactions("drug1Id");
      CREATE INDEX IF NOT EXISTS drug_interactions_drug2_idx ON drug_interactions("drug2Id");
      CREATE INDEX IF NOT EXISTS drug_interactions_type_idx ON drug_interactions("interactionType");
    `, { transaction });

    console.log('⏰ Creating expiry_alerts table...');
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_expiry_alerts_alert_type') THEN
          CREATE TYPE enum_expiry_alerts_alert_type AS ENUM ('expired', 'expiring_soon', 'expiring_30_days', 'expiring_60_days', 'expiring_90_days');
        END IF;
      END
      $$;
    `, { transaction });

    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS expiry_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "drugId" UUID NOT NULL REFERENCES drugs(id) ON UPDATE CASCADE ON DELETE CASCADE,
        "batchNumber" VARCHAR(100),
        "expiryDate" DATE NOT NULL,
        quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
        "alertType" enum_expiry_alerts_alert_type NOT NULL,
        "daysUntilExpiry" INTEGER,
        "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
        "acknowledgedBy" UUID REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
        "acknowledgedAt" TIMESTAMPTZ,
        notes TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `, { transaction });

    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS expiry_alerts_tenant_idx ON expiry_alerts("tenantId");
      CREATE INDEX IF NOT EXISTS expiry_alerts_drug_idx ON expiry_alerts("drugId");
      CREATE INDEX IF NOT EXISTS expiry_alerts_expiry_idx ON expiry_alerts("expiryDate");
      CREATE INDEX IF NOT EXISTS expiry_alerts_type_idx ON expiry_alerts("alertType");
      CREATE INDEX IF NOT EXISTS expiry_alerts_acknowledged_idx ON expiry_alerts("isAcknowledged");
    `, { transaction });

    await transaction.commit();
    console.log('✅ Shop and pharmacy tables migration completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('💥 Failed to create shop and pharmacy tables:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run migration if called directly
if (require.main === module) {
  createShopPharmacyTables()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createShopPharmacyTables;
