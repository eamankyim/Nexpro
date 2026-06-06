/**
 * Backfill existing order/sale shop scope for a tenant that should have one main shop.
 *
 * Dry-run is the default. Writes require both --execute and --confirm-backfill.
 *
 * Usage:
 *   node scripts/backfill-single-shop-orders.js --email barimafoodbox@gmail.com
 *   node scripts/backfill-single-shop-orders.js --email barimafoodbox@gmail.com --tenant-id <tenant-id>
 *   node scripts/backfill-single-shop-orders.js --tenant-id <tenant-id>
 *   node scripts/backfill-single-shop-orders.js --tenant-id <tenant-id> --shop-id <shop-id>
 *   node scripts/backfill-single-shop-orders.js --email barimafoodbox@gmail.com --execute --confirm-backfill
 *
 * This script updates only the resolved tenant's sale/order-related rows whose shopId
 * is NULL or not equal to the resolved shopId. It does not create shops.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { QueryTypes } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');

const isExecute = process.argv.includes('--execute');
const isConfirmed = process.argv.includes('--confirm-backfill');
const isDryRun = !isExecute;
const SAMPLE_LIMIT = 10;

const getArgValue = (name, fallback = null) => {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--')) {
    return process.argv[index + 1];
  }
  return fallback;
};

const requestedEmail = getArgValue('--email')?.trim().toLowerCase() || null;
const requestedTenantId = getArgValue('--tenant-id')?.trim() || null;
const requestedShopId = getArgValue('--shop-id')?.trim() || null;

const quoteIdent = (identifier) => {
  if (!/^[a-z][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
};

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :tableName
     LIMIT 1`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const columnExists = async (tableName, columnName) => {
  const rows = await sequelize.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = :tableName AND column_name = :columnName
     LIMIT 1`,
    { replacements: { tableName, columnName }, type: QueryTypes.SELECT }
  );
  return rows.length > 0;
};

const getUpdatedAtAssignment = async (tableName) => (
  await columnExists(tableName, 'updatedAt') ? ', "updatedAt" = NOW()' : ''
);

const countRows = async (sql, replacements, transaction = null) => {
  const rows = await sequelize.query(sql, {
    replacements,
    transaction,
    type: QueryTypes.SELECT,
  });
  return Number(rows[0]?.count || 0);
};

const getSamples = async (sql, replacements, transaction = null) => sequelize.query(sql, {
  replacements: { ...replacements, sampleLimit: SAMPLE_LIMIT },
  transaction,
  type: QueryTypes.SELECT,
});

const runUpdate = async (sql, replacements, transaction) => {
  const [, metadata] = await sequelize.query(sql, { replacements, transaction });
  return Number(metadata?.rowCount || 0);
};

const resolveTenant = async () => {
  if (!requestedEmail && !requestedTenantId) {
    throw new Error('Provide --email or --tenant-id.');
  }

  if (requestedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedEmail)) {
    throw new Error(`Invalid --email "${requestedEmail}"`);
  }

  if (requestedTenantId && !requestedEmail) {
    const rows = await sequelize.query(
      `SELECT id, name, "businessType", status
       FROM tenants
       WHERE id = :tenantId
       LIMIT 1`,
      { replacements: { tenantId: requestedTenantId }, type: QueryTypes.SELECT }
    );
    if (!rows.length) throw new Error(`No tenant found for --tenant-id ${requestedTenantId}`);
    return rows[0];
  }

  const rows = await sequelize.query(
    `SELECT DISTINCT t.id, t.name, t."businessType", t.status, t."createdAt", ut.role AS "membershipRole"
     FROM tenants t
     INNER JOIN user_tenants ut ON ut."tenantId" = t.id
     INNER JOIN users u ON u.id = ut."userId"
     WHERE LOWER(u.email) = :email
       AND ut.status = 'active'
       AND (:tenantId IS NULL OR t.id = :tenantId)
     ORDER BY t."createdAt" ASC`,
    {
      replacements: { email: requestedEmail, tenantId: requestedTenantId },
      type: QueryTypes.SELECT,
    }
  );

  if (!rows.length) {
    throw new Error(
      `No active tenant membership found for ${requestedEmail}${requestedTenantId ? ` and tenant ${requestedTenantId}` : ''}`
    );
  }
  if (rows.length > 1 && !requestedTenantId) {
    throw new Error(
      `Email ${requestedEmail} matches multiple tenants. Re-run with --tenant-id. Matches: ${rows
        .map((tenant) => `${tenant.name} (${tenant.id}, role=${tenant.membershipRole})`)
        .join('; ')}`
    );
  }

  return rows[0];
};

const resolveShop = async (tenantId) => {
  const shops = await sequelize.query(
    `SELECT id, name, code, "isActive", "isDefault", "createdAt"
     FROM shops
     WHERE "tenantId" = :tenantId
     ORDER BY "isDefault" DESC, "isActive" DESC, "createdAt" ASC`,
    { replacements: { tenantId }, type: QueryTypes.SELECT }
  );

  if (requestedShopId) {
    const shop = shops.find((row) => row.id === requestedShopId);
    if (!shop) {
      throw new Error(`Shop ${requestedShopId} does not belong to tenant ${tenantId}`);
    }
    return { shop, shops };
  }

  if (shops.length !== 1) {
    throw new Error(
      `Tenant ${tenantId} has ${shops.length} shops. Re-run with --shop-id after verifying the target shop. Shops: ${shops
        .map((shop) => `${shop.name} (${shop.id}, default=${shop.isDefault}, active=${shop.isActive})`)
        .join('; ') || 'none'}`
    );
  }

  return { shop: shops[0], shops };
};

const getShopDistribution = async (tableName, tenantId) => {
  if (!(await tableExists(tableName)) || !(await columnExists(tableName, 'tenantId')) || !(await columnExists(tableName, 'shopId'))) {
    return [];
  }

  return sequelize.query(
    `SELECT COALESCE("shopId"::text, 'NULL') AS "shopId", COUNT(*)::int AS count
     FROM ${quoteIdent(tableName)}
     WHERE "tenantId" = :tenantId
     GROUP BY COALESCE("shopId"::text, 'NULL')
     ORDER BY count DESC, "shopId" ASC`,
    { replacements: { tenantId }, type: QueryTypes.SELECT }
  );
};

const buildTargets = async () => {
  const targets = [];

  if (await tableExists('sales') && await columnExists('sales', 'tenantId') && await columnExists('sales', 'shopId')) {
    const updatedAtAssignment = await getUpdatedAtAssignment('sales');
    targets.push({
      key: 'sales',
      label: 'sales.shopId',
      countSql: `SELECT COUNT(*)::int AS count FROM sales WHERE "tenantId" = :tenantId AND "shopId" IS DISTINCT FROM :shopId`,
      sampleSql: `SELECT id, "saleNumber", "shopId", "orderStatus", "createdAt"
                  FROM sales
                  WHERE "tenantId" = :tenantId AND "shopId" IS DISTINCT FROM :shopId
                  ORDER BY "createdAt" DESC
                  LIMIT :sampleLimit`,
      updateSql: `UPDATE sales
                  SET "shopId" = :shopId${updatedAtAssignment}
                  WHERE "tenantId" = :tenantId AND "shopId" IS DISTINCT FROM :shopId`,
    });
  } else {
    targets.push({ key: 'sales', label: 'sales.shopId', skipped: 'missing sales.tenantId/shopId' });
  }

  const hasInvoiceTarget =
    await tableExists('invoices')
    && await columnExists('invoices', 'tenantId')
    && await columnExists('invoices', 'shopId');
  if (hasInvoiceTarget) {
    const hasSaleId = await columnExists('invoices', 'saleId');
    const hasSourceType = await columnExists('invoices', 'sourceType');
    const relatedConditions = [];
    if (hasSaleId && await tableExists('sales')) {
      relatedConditions.push('i."saleId" IN (SELECT s.id FROM sales s WHERE s."tenantId" = :tenantId)');
    }
    if (hasSourceType) {
      relatedConditions.push(`i."sourceType" = 'sale'`);
    }

    if (relatedConditions.length) {
      const relatedWhere = `i."tenantId" = :tenantId AND i."shopId" IS DISTINCT FROM :shopId AND (${relatedConditions.join(' OR ')})`;
      const updatedAtAssignment = await getUpdatedAtAssignment('invoices');
      targets.push({
        key: 'saleInvoices',
        label: 'sale-related invoices.shopId',
        countSql: `SELECT COUNT(*)::int AS count FROM invoices i WHERE ${relatedWhere}`,
        sampleSql: `SELECT i.id, i."invoiceNumber", i."saleId", i."shopId", i."sourceType", i."createdAt"
                    FROM invoices i
                    WHERE ${relatedWhere}
                    ORDER BY i."createdAt" DESC
                    LIMIT :sampleLimit`,
        updateSql: `UPDATE invoices i
                    SET "shopId" = :shopId${updatedAtAssignment}
                    WHERE ${relatedWhere}`,
      });
    } else {
      targets.push({ key: 'saleInvoices', label: 'sale-related invoices.shopId', skipped: 'missing invoices.saleId/sourceType' });
    }
  } else {
    targets.push({ key: 'saleInvoices', label: 'sale-related invoices.shopId', skipped: 'missing invoices.tenantId/shopId' });
  }

  for (const tableName of ['sale_items', 'sale_activities']) {
    const hasTarget =
      await tableExists(tableName)
      && await columnExists(tableName, 'saleId')
      && await columnExists(tableName, 'shopId')
      && await tableExists('sales');
    if (!hasTarget) {
      targets.push({ key: tableName, label: `${tableName}.shopId`, skipped: 'no direct shopId scope column' });
      continue;
    }

    const alias = tableName === 'sale_items' ? 'si' : 'sa';
    const updatedAtAssignment = await getUpdatedAtAssignment(tableName);
    const relatedWhere = `${alias}."shopId" IS DISTINCT FROM :shopId
      AND EXISTS (
        SELECT 1 FROM sales s
        WHERE s.id = ${alias}."saleId" AND s."tenantId" = :tenantId
      )`;
    targets.push({
      key: tableName,
      label: `${tableName}.shopId`,
      countSql: `SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)} ${alias} WHERE ${relatedWhere}`,
      sampleSql: `SELECT ${alias}.id, ${alias}."saleId", ${alias}."shopId", ${alias}."createdAt"
                  FROM ${quoteIdent(tableName)} ${alias}
                  WHERE ${relatedWhere}
                  ORDER BY ${alias}."createdAt" DESC
                  LIMIT :sampleLimit`,
      updateSql: `UPDATE ${quoteIdent(tableName)} ${alias}
                  SET "shopId" = :shopId${updatedAtAssignment}
                  WHERE ${relatedWhere}`,
    });
  }

  return targets;
};

const printSamples = (samples) => {
  if (!samples.length) {
    console.log('    samples: none');
    return;
  }

  console.log('    samples:');
  for (const sample of samples) {
    const pieces = Object.entries(sample).map(([key, value]) => `${key}=${value === null ? 'NULL' : value}`);
    console.log(`      - ${pieces.join(', ')}`);
  }
};

const printDistribution = (label, rows) => {
  if (!rows.length) {
    console.log(`  ${label}: none`);
    return;
  }
  console.log(`  ${label}: ${rows.map((row) => `${row.shopId}:${row.count}`).join(', ')}`);
};

async function main() {
  if (isExecute && !isConfirmed) {
    throw new Error('Writes require --execute --confirm-backfill.');
  }

  await testConnection();
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'EXECUTE'}`);
  if (requestedEmail) console.log(`Email: ${requestedEmail}`);
  if (requestedTenantId) console.log(`Tenant filter: ${requestedTenantId}`);
  if (requestedShopId) console.log(`Explicit shop: ${requestedShopId}`);
  console.log('');

  const tenant = await resolveTenant();
  const { shop, shops } = await resolveShop(tenant.id);
  const replacements = { tenantId: tenant.id, shopId: shop.id };
  const targets = await buildTargets();

  console.log(`Tenant: ${tenant.name} (${tenant.id}) type=${tenant.businessType || 'unset'} status=${tenant.status || 'unknown'}`);
  console.log(`Shop: ${shop.name} (${shop.id}) default=${shop.isDefault} active=${shop.isActive}`);
  console.log(`Shop count: ${shops.length}`);
  printDistribution('sales shop distribution', await getShopDistribution('sales', tenant.id));
  printDistribution('invoices shop distribution', await getShopDistribution('invoices', tenant.id));
  console.log('');

  const run = async (transaction = null) => {
    const results = [];
    for (const target of targets) {
      if (target.skipped) {
        results.push({ ...target, count: 0, updated: 0, samples: [] });
        continue;
      }

      const count = await countRows(target.countSql, replacements, transaction);
      const samples = await getSamples(target.sampleSql, replacements, transaction);
      const updated = isExecute && count > 0
        ? await runUpdate(target.updateSql, replacements, transaction)
        : 0;
      results.push({ ...target, count, updated, samples });
    }
    return results;
  };

  const results = isExecute ? await sequelize.transaction(run) : await run();

  let totalCandidates = 0;
  let totalUpdated = 0;
  for (const result of results) {
    if (result.skipped) {
      console.log(`[skip] ${result.label}: ${result.skipped}`);
      continue;
    }

    totalCandidates += result.count;
    totalUpdated += result.updated;
    console.log(
      `[${isDryRun ? 'dry-run' : 'execute'}] ${result.label}: ${isDryRun ? 'would update' : 'updated'}=${isDryRun ? result.count : result.updated}`
    );
    printSamples(result.samples);
  }

  console.log('');
  console.log(`Done. ${isDryRun ? 'Would update' : 'Updated'} ${isDryRun ? totalCandidates : totalUpdated} rows.`);
  if (isDryRun) {
    console.log('Re-run with --execute --confirm-backfill to apply the changes.');
  }

  await sequelize.close();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
