#!/usr/bin/env node
/**
 * Import consolidated JOSFAA product data from three Excel workbooks into one tenant shop.
 *
 * Source files (defaults point to Desktop):
 * - STOCKS JOSFAA lateest.xlsx  -> quantityOnHand (BAL QTY), identity fields
 * - 1ST SHIPMENT.xlsx           -> WAC (GH) -> cost input, SP -> selling fallback
 * - 2ND SHIPMENT.xlsx           -> WAC -> cost input, WSP -> preferred selling price
 *
 * Mapping rules:
 * - WAC / WAC (GH) -> Product.costPrice (weighted across shipments when present in both)
 * - 2nd WSP preferred over 1st SP for Product.sellingPrice
 * - BAL QTY -> Product.quantityOnHand
 * - DESCRIPTION -> Product.name
 * - BRAND -> Product.brand
 * - PART NO. -> Product.sku (normalized string, unique per tenant)
 * - Category -> Auto Parts
 * - Shipment metadata preserved on Product.metadata
 * - Dedupe by normalized PART NO.; fallback BRAND+DESCRIPTION when part number missing
 *
 * Safety model:
 * - Dry run by default
 * - Requires --execute and --confirm-import for real writes
 * - Skips existing tenant products matched by SKU/barcode
 *
 * Usage (from Backend/):
 *   node scripts/import-josfaa-products.js --email raphine19@gmail.com --shop-name "JOSFAA Ent. (Warehouse)"
 *   node scripts/import-josfaa-products.js --email raphine19@gmail.com --shop-name "JOSFAA Ent. (Warehouse)" --execute --confirm-import
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const { User, UserTenant, Tenant, Product, ProductCategory, Shop, Barcode } = require('../models');

const DEFAULT_STOCKS_PATH = '/Users/us/Desktop/STOCKS JOSFAA lateest.xlsx';
const DEFAULT_FIRST_SHIPMENT_PATH = '/Users/us/Desktop/1ST SHIPMENT.xlsx';
const DEFAULT_SECOND_SHIPMENT_PATH = '/Users/us/Desktop/2ND SHIPMENT.xlsx';
const CATEGORY_NAME = 'Auto Parts';
const SCRIPT_NAME = 'scripts/import-josfaa-products.js';

const argv = process.argv.slice(2);
const hasFlag = (flag) => argv.includes(flag);
const getArgValue = (flag, fallback = null) => {
  const idx = argv.indexOf(flag);
  if (idx === -1 || idx === argv.length - 1) return fallback;
  return argv[idx + 1];
};

const isExecute = hasFlag('--execute');
const isDryRun = !isExecute || hasFlag('--dry-run');
const shouldConfirm = hasFlag('--confirm-import');
const email = (getArgValue('--email', '') || '').trim().toLowerCase();
const explicitTenantId = (getArgValue('--tenant-id', '') || '').trim() || null;
const explicitShopId = (getArgValue('--shop-id', '') || '').trim() || null;
const explicitShopName = normalizeText(getArgValue('--shop-name', 'JOSFAA Ent. (Warehouse)')) || null;
const stocksPathArg = getArgValue('--stocks-path', null);
const firstShipmentPathArg = getArgValue('--first-shipment-path', null);
const secondShipmentPathArg = getArgValue('--second-shipment-path', null);
const stocksPath = path.resolve(stocksPathArg || DEFAULT_STOCKS_PATH);
const firstShipmentPath = path.resolve(firstShipmentPathArg || DEFAULT_FIRST_SHIPMENT_PATH);
const secondShipmentPath = path.resolve(secondShipmentPathArg || DEFAULT_SECOND_SHIPMENT_PATH);
const usingDefaultSourcePaths = !stocksPathArg && !firstShipmentPathArg && !secondShipmentPathArg;

const USAGE = `
Usage:
  node scripts/import-josfaa-products.js --email <user-email> [--shop-name <name> | --shop-id <uuid>] [--tenant-id <uuid>] [--dry-run | --execute --confirm-import]
  [--stocks-path <path>] [--first-shipment-path <path>] [--second-shipment-path <path>]

Examples:
  node scripts/import-josfaa-products.js --email raphine19@gmail.com --shop-name "JOSFAA Ent. (Warehouse)"

  node scripts/import-josfaa-products.js \\
    --email raphine19@gmail.com \\
    --shop-name "JOSFAA Ent. (Warehouse)" \\
    --stocks-path "/root/nexpro/imports/STOCKS JOSFAA lateest.xlsx" \\
    --first-shipment-path "/root/nexpro/imports/1ST SHIPMENT.xlsx" \\
    --second-shipment-path "/root/nexpro/imports/2ND SHIPMENT.xlsx" \\
    --execute --confirm-import
`;

function fail(message) {
  console.error(`\nERROR: ${message}`);
  console.error(USAGE);
  process.exit(1);
}

function printSummary(label, value) {
  console.log(`${String(label).padEnd(34)} ${value}`);
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizedKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePartNo(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  if (/^(TOTAL|N\/A|NA|NULL|NONE)$/i.test(raw)) return '';
  return raw.toUpperCase();
}

function toNumber(value, fallback = 0) {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '')
    .trim();
  if (!cleaned) return fallback;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round(toNumber(value, 0) * 100) / 100;
}

function slugify(value, maxLength = 48) {
  const slug = normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) return 'ITEM';
  return slug.length > maxLength ? slug.slice(0, maxLength) : slug;
}

function fallbackIdentityKey(brand, description) {
  return `NO-PART:${normalizedKey(brand)}|${normalizedKey(description)}`;
}

function productIdentityKey(partNo, brand, description) {
  return partNo || fallbackIdentityKey(brand, description);
}

function isSummaryRow({ description, brand, partNo, quantity }) {
  if (!description && !brand && !partNo) return true;
  if (description === '[object Object]') return true;
  if (!description && !partNo && quantity > 10000) return true;
  return false;
}

function getCellText(row, columnIndex) {
  const cell = row.getCell(columnIndex);
  if (cell == null) return '';
  if (typeof cell.text === 'string') return cell.text;
  if (cell.value == null) return '';
  if (typeof cell.value === 'object' && cell.value.richText) {
    return cell.value.richText.map((part) => part.text || '').join('');
  }
  return String(cell.value);
}

function validateSourcePaths() {
  const sources = [
    { label: 'Stocks', flag: '--stocks-path', filePath: stocksPath },
    { label: '1st shipment', flag: '--first-shipment-path', filePath: firstShipmentPath },
    { label: '2nd shipment', flag: '--second-shipment-path', filePath: secondShipmentPath },
  ];
  const missing = sources.filter(({ filePath }) => !fs.existsSync(filePath));
  if (!missing.length) return;

  const isMacDefaultPath = (filePath) => filePath.startsWith('/Users/');
  const onNonMac = process.platform !== 'darwin';
  const usingMacDefaults = usingDefaultSourcePaths
    && sources.some(({ filePath }) => isMacDefaultPath(filePath));

  console.error('\nERROR: Source workbook(s) not found:');
  missing.forEach(({ label, filePath }) => {
    console.error(`- ${label}: ${filePath}`);
  });

  if (onNonMac || usingMacDefaults) {
    console.error('\nThis script defaults to macOS Desktop paths. On a Linux server, upload the 3 .xlsx files and pass explicit paths, for example:');
    console.error('  mkdir -p ~/nexpro/imports');
    console.error('  # upload: "STOCKS JOSFAA lateest.xlsx", "1ST SHIPMENT.xlsx", "2ND SHIPMENT.xlsx"');
    console.error('');
    console.error('  node scripts/import-josfaa-products.js \\');
    console.error('    --email raphine19@gmail.com \\');
    console.error('    --shop-name "JOSFAA Ent. (Warehouse)" \\');
    console.error('    --stocks-path "/root/nexpro/imports/STOCKS JOSFAA lateest.xlsx" \\');
    console.error('    --first-shipment-path "/root/nexpro/imports/1ST SHIPMENT.xlsx" \\');
    console.error('    --second-shipment-path "/root/nexpro/imports/2ND SHIPMENT.xlsx" \\');
    console.error('    --dry-run');
  } else {
    missing.forEach(({ flag, filePath }) => {
      console.error(`\nRe-run with ${flag} "${filePath}"`);
    });
  }

  console.error(USAGE);
  process.exit(1);
}

async function readWorkbook(filePath) {
  if (!fs.existsSync(filePath)) fail(`Source file not found: ${filePath}`);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  if (!workbook.worksheets.length) fail(`Workbook has no sheets: ${filePath}`);
  return workbook.worksheets[0];
}

function aggregateShipmentEntry(existing, incoming) {
  if (!existing) return { ...incoming };

  const totalQty = existing.qty + incoming.qty;
  const weightedWac = totalQty > 0
    ? ((existing.wac * existing.qty) + (incoming.wac * incoming.qty)) / totalQty
    : incoming.wac || existing.wac;

  return {
    ...existing,
    qty: totalQty,
    wac: roundMoney(weightedWac),
    sellingPrice: incoming.sellingPrice || existing.sellingPrice,
    sourceRows: [...existing.sourceRows, ...incoming.sourceRows],
  };
}

function buildShipmentMap(rows, { qtyColumn, wacColumn, sellingPriceColumn, sourceFile, sourceLabel }) {
  const map = new Map();

  rows.forEach((row) => {
    const description = normalizeText(row.description);
    const brand = normalizeText(row.brand);
    const partNo = normalizePartNo(row.partNo);
    const qty = Math.max(0, toNumber(row[qtyColumn], 0));
    const wac = roundMoney(row[wacColumn]);
    const sellingPrice = roundMoney(row[sellingPriceColumn]);
    const sourceRow = row.sourceRow;

    if (isSummaryRow({ description, brand, partNo, quantity: qty })) return;

    const key = productIdentityKey(partNo, brand, description);
    const entry = {
      key,
      partNo: partNo || null,
      description,
      brand,
      qty,
      wac,
      sellingPrice,
      sourceFile,
      sourceLabel,
      sourceRows: [sourceRow],
    };

    map.set(key, aggregateShipmentEntry(map.get(key), entry));
  });

  return map;
}

async function parseStockRows(filePath) {
  const sheet = await readWorkbook(filePath);
  const rows = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const description = normalizeText(getCellText(row, 2));
    const brand = normalizeText(getCellText(row, 3));
    const partNo = normalizePartNo(getCellText(row, 4));
    const firstShipmentQty = toNumber(getCellText(row, 5), 0);
    const secondShipmentQty = toNumber(getCellText(row, 6), 0);
    const totalQty = toNumber(getCellText(row, 7), 0);
    const qtySold = toNumber(getCellText(row, 8), 0);
    const balanceQty = toNumber(getCellText(row, 9), 0);

    if (isSummaryRow({ description, brand, partNo, quantity: balanceQty })) continue;

    rows.push({
      sourceRow: rowNumber,
      description,
      brand,
      partNo,
      firstShipmentQty,
      secondShipmentQty,
      totalQty,
      qtySold,
      balanceQty,
      identityKey: productIdentityKey(partNo, brand, description),
    });
  }

  return rows;
}

async function parseShipmentRows(filePath, headerRowNumber) {
  const sheet = await readWorkbook(filePath);
  const rows = [];

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    rows.push({
      sourceRow: rowNumber,
      description: getCellText(row, 2),
      brand: getCellText(row, 3),
      partNo: getCellText(row, 4),
      josfaaQty: getCellText(row, 7),
      qty: getCellText(row, 5),
      wacGh: getCellText(row, 13),
      sp: getCellText(row, 15),
      wac: getCellText(row, 7),
      wsp: getCellText(row, 9),
    });
  }

  return rows;
}

function computeWeightedCost(firstShipment, secondShipment) {
  const firstQty = firstShipment?.qty || 0;
  const secondQty = secondShipment?.qty || 0;
  const firstWac = firstShipment?.wac || 0;
  const secondWac = secondShipment?.wac || 0;

  if (firstQty > 0 && secondQty > 0) {
    return {
      costPrice: roundMoney(((firstWac * firstQty) + (secondWac * secondQty)) / (firstQty + secondQty)),
      method: 'weighted-average-across-shipments',
    };
  }
  if (secondQty > 0 || secondWac > 0) {
    return { costPrice: roundMoney(secondWac), method: 'second-shipment-wac' };
  }
  if (firstQty > 0 || firstWac > 0) {
    return { costPrice: roundMoney(firstWac), method: 'first-shipment-wac-gh' };
  }
  return { costPrice: 0, method: 'missing-wac' };
}

function computeSellingPrice(firstShipment, secondShipment) {
  const secondPrice = secondShipment?.sellingPrice || 0;
  if (secondPrice > 0) {
    return { sellingPrice: roundMoney(secondPrice), source: 'second-shipment-wsp' };
  }
  const firstPrice = firstShipment?.sellingPrice || 0;
  if (firstPrice > 0) {
    return { sellingPrice: roundMoney(firstPrice), source: 'first-shipment-sp' };
  }
  return { sellingPrice: 0, source: 'missing-price' };
}

function stockProductKey(stockRow) {
  const partNo = stockRow.partNo;
  if (!partNo) return fallbackIdentityKey(stockRow.brand, stockRow.description);
  return `PART:${partNo}|${normalizedKey(stockRow.brand)}|${normalizedKey(stockRow.description)}`;
}

function shipmentLookupKey(partNo, brand, description) {
  return productIdentityKey(partNo, brand, description);
}

function assignUniqueSkus(products) {
  const usedSkus = new Set();
  const skuWarnings = [];

  const withSkus = products.map((product) => {
    const baseSku = product.partNo
      ? product.partNo
      : `NOPART-${slugify(`${product.brand}-${product.name}`, 40)}`;

    let sku = baseSku;
    if (usedSkus.has(sku)) {
      sku = `${baseSku}-${slugify(`${product.brand}-${product.name}`, 32)}`;
      skuWarnings.push({
        type: 'sku-disambiguated',
        partNo: product.partNo || null,
        name: product.name,
        sku,
      });
    }

    let suffix = 2;
    while (usedSkus.has(sku)) {
      sku = `${baseSku}-${suffix}`;
      suffix += 1;
    }

    usedSkus.add(sku);
    return { ...product, sku };
  });

  return { products: withSkus, skuWarnings };
}

function consolidateProducts({ stockRows, firstShipmentMap, secondShipmentMap }) {
  const mergedByProductKey = new Map();
  const exceptions = [];
  const duplicatePartWarnings = new Set();

  stockRows.forEach((stockRow) => {
    const productKey = stockProductKey(stockRow);
    const shipmentKey = shipmentLookupKey(stockRow.partNo, stockRow.brand, stockRow.description);
    const existing = mergedByProductKey.get(productKey);

    if (existing) {
      existing.quantityOnHand += stockRow.balanceQty;
      existing.metadata.shipments.stock.sourceRows.push(stockRow.sourceRow);
      existing.metadata.shipments.stock.balanceQty += stockRow.balanceQty;
      return;
    }

    const firstShipment = firstShipmentMap.get(shipmentKey) || null;
    const secondShipment = secondShipmentMap.get(shipmentKey) || null;
    const { costPrice, method: costPriceMethod } = computeWeightedCost(firstShipment, secondShipment);
    const { sellingPrice, source: sellingPriceSource } = computeSellingPrice(firstShipment, secondShipment);

    if (stockRow.partNo && !duplicatePartWarnings.has(stockRow.partNo)) {
      const samePartRows = stockRows.filter((row) => row.partNo === stockRow.partNo);
      const distinctProducts = new Set(samePartRows.map((row) => stockProductKey(row)));
      if (distinctProducts.size > 1) {
        duplicatePartWarnings.add(stockRow.partNo);
        exceptions.push({
          type: 'duplicate-part-different-product',
          partNo: stockRow.partNo,
          name: stockRow.description,
          sourceRow: stockRow.sourceRow,
          variantCount: distinctProducts.size,
        });
      }
    }

    if (costPriceMethod === 'missing-wac') {
      exceptions.push({
        type: 'missing-wac',
        identityKey: shipmentKey,
        name: stockRow.description,
        sourceRow: stockRow.sourceRow,
      });
    }
    if (sellingPriceSource === 'missing-price') {
      exceptions.push({
        type: 'missing-selling-price',
        identityKey: shipmentKey,
        name: stockRow.description,
        sourceRow: stockRow.sourceRow,
      });
    }

    mergedByProductKey.set(productKey, {
      partNo: stockRow.partNo || null,
      name: stockRow.description,
      brand: stockRow.brand || null,
      quantityOnHand: stockRow.balanceQty,
      costPrice,
      sellingPrice,
      metadata: {
        importSource: 'josfaa-consolidated',
        importedByScript: SCRIPT_NAME,
        partNo: stockRow.partNo || null,
        costPriceMethod,
        sellingPriceSource,
        shipments: {
          stock: {
            sourceFile: path.basename(stocksPath),
            sourceRows: [stockRow.sourceRow],
            firstShipmentQty: stockRow.firstShipmentQty,
            secondShipmentQty: stockRow.secondShipmentQty,
            totalQty: stockRow.totalQty,
            qtySold: stockRow.qtySold,
            balanceQty: stockRow.balanceQty,
          },
          first: firstShipment
            ? {
              sourceFile: path.basename(firstShipmentPath),
              sourceRows: firstShipment.sourceRows,
              qty: firstShipment.qty,
              wac: firstShipment.wac,
              sellingPrice: firstShipment.sellingPrice,
            }
            : null,
          second: secondShipment
            ? {
              sourceFile: path.basename(secondShipmentPath),
              sourceRows: secondShipment.sourceRows,
              qty: secondShipment.qty,
              wac: secondShipment.wac,
              sellingPrice: secondShipment.sellingPrice,
            }
            : null,
        },
      },
    });
  });

  const shipmentOnlyKeys = new Set([
    ...firstShipmentMap.keys(),
    ...secondShipmentMap.keys(),
  ]);
  const stockShipmentKeys = new Set(
    stockRows.map((row) => shipmentLookupKey(row.partNo, row.brand, row.description))
  );

  shipmentOnlyKeys.forEach((shipmentKey) => {
    if (stockShipmentKeys.has(shipmentKey)) return;

    const firstShipment = firstShipmentMap.get(shipmentKey) || null;
    const secondShipment = secondShipmentMap.get(shipmentKey) || null;
    const source = secondShipment || firstShipment;
    const { costPrice, method: costPriceMethod } = computeWeightedCost(firstShipment, secondShipment);
    const { sellingPrice, source: sellingPriceSource } = computeSellingPrice(firstShipment, secondShipment);

    exceptions.push({
      type: 'shipment-only-product',
      identityKey: shipmentKey,
      name: source.description,
      partNo: source.partNo || null,
      sourceRows: [...(firstShipment?.sourceRows || []), ...(secondShipment?.sourceRows || [])],
    });

    mergedByProductKey.set(`SHIPMENT:${shipmentKey}`, {
      partNo: source.partNo || null,
      name: source.description,
      brand: source.brand || null,
      quantityOnHand: 0,
      costPrice,
      sellingPrice,
      metadata: {
        importSource: 'josfaa-consolidated',
        importedByScript: SCRIPT_NAME,
        partNo: source.partNo || null,
        costPriceMethod,
        sellingPriceSource,
        shipments: {
          stock: null,
          first: firstShipment
            ? {
              sourceFile: path.basename(firstShipmentPath),
              sourceRows: firstShipment.sourceRows,
              qty: firstShipment.qty,
              wac: firstShipment.wac,
              sellingPrice: firstShipment.sellingPrice,
            }
            : null,
          second: secondShipment
            ? {
              sourceFile: path.basename(secondShipmentPath),
              sourceRows: secondShipment.sourceRows,
              qty: secondShipment.qty,
              wac: secondShipment.wac,
              sellingPrice: secondShipment.sellingPrice,
            }
            : null,
        },
      },
    });
  });

  const { products, skuWarnings } = assignUniqueSkus(Array.from(mergedByProductKey.values()));
  return { products, exceptions: [...exceptions, ...skuWarnings] };
}

async function resolveTenantById(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'name', 'status', 'businessType'],
    raw: true,
  });
  if (!tenant) throw new Error(`No tenant found for tenantId: ${tenantId}`);
  return { user: null, tenant, tenantId: tenant.id, membershipRole: null };
}

async function resolveTenantByEmail(targetEmail, tenantIdOverride) {
  const user = await User.findOne({
    where: { email: targetEmail },
    attributes: ['id', 'email', 'name'],
    raw: true,
  });
  if (!user) throw new Error(`No user found for email: ${targetEmail}`);

  const memberships = await UserTenant.findAll({
    where: {
      userId: user.id,
      status: { [Op.in]: ['active', 'invited'] },
      ...(tenantIdOverride ? { tenantId: tenantIdOverride } : {}),
    },
    include: [{ model: Tenant, as: 'tenant', attributes: ['id', 'name', 'status', 'businessType'] }],
    order: [['createdAt', 'ASC']],
  });

  if (!memberships.length) {
    const suffix = tenantIdOverride ? ` for tenant ${tenantIdOverride}` : '';
    throw new Error(`User ${targetEmail} has no tenant membership${suffix}`);
  }

  if (memberships.length > 1 && !tenantIdOverride) {
    console.error('\nUser belongs to multiple tenants. Re-run with --tenant-id:');
    memberships.forEach((membership) => {
      console.error(`- ${membership.tenantId} (${membership.tenant?.name || 'Unknown tenant'}) status=${membership.tenant?.status || 'unknown'}`);
    });
    process.exit(1);
  }

  const selected = memberships[0];
  return {
    user,
    tenant: selected.tenant?.toJSON ? selected.tenant.toJSON() : selected.tenant,
    tenantId: selected.tenantId,
    membershipRole: selected.role,
  };
}

async function resolveTenantTarget() {
  if (email) return resolveTenantByEmail(email, explicitTenantId);
  if (explicitTenantId) return resolveTenantById(explicitTenantId);
  fail('Missing --email or --tenant-id');
  return null;
}

async function resolveShop(tenantId) {
  if (explicitShopId) {
    const shop = await Shop.findOne({ where: { id: explicitShopId, tenantId } });
    if (!shop) throw new Error(`No shop ${explicitShopId} found for tenant ${tenantId}`);
    if (explicitShopName && !normalizedKey(shop.name).includes(normalizedKey(explicitShopName))) {
      throw new Error(`Shop ${explicitShopId} (${shop.name}) does not match --shop-name "${explicitShopName}"`);
    }
    return shop;
  }

  if (!explicitShopName) throw new Error('Missing --shop-name or --shop-id');

  const shops = await Shop.findAll({
    where: { tenantId },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  const searchName = normalizedKey(explicitShopName);
  const exactMatches = shops.filter((shop) => normalizedKey(shop.name) === searchName);
  const partialMatches = shops.filter((shop) => normalizedKey(shop.name).includes(searchName));
  const matches = exactMatches.length ? exactMatches : partialMatches;

  if (!matches.length) throw new Error(`No shop matching "${explicitShopName}" found for tenant ${tenantId}`);
  if (matches.length > 1) {
    console.error(`\nMultiple shops matched "${explicitShopName}". Re-run with --shop-id:`);
    matches.forEach((match) => {
      console.error(`- ${match.id} (${match.name})${match.isDefault ? ' default' : ''}`);
    });
    process.exit(1);
  }

  return matches[0];
}

async function loadCategory(tenantId) {
  const existing = await ProductCategory.findOne({
    where: {
      tenantId,
      name: { [Op.iLike]: CATEGORY_NAME },
    },
  });
  return existing;
}

async function ensureCategory(tenantId, transaction) {
  const existing = await loadCategory(tenantId);
  if (existing) return existing;

  return ProductCategory.create({
    tenantId,
    name: CATEGORY_NAME,
    description: 'Imported JOSFAA auto parts category',
    isActive: true,
    metadata: {
      importSource: 'josfaa-consolidated',
      importedByScript: SCRIPT_NAME,
    },
  }, { transaction });
}

async function findExistingBySkus(tenantId, skus) {
  if (!skus.length) return new Map();

  const products = await Product.findAll({
    where: {
      tenantId,
      [Op.or]: [
        { sku: { [Op.in]: skus } },
        { barcode: { [Op.in]: skus } },
      ],
    },
    attributes: ['id', 'name', 'sku', 'barcode', 'shopId'],
    raw: true,
  });

  const map = new Map();
  products.forEach((product) => {
    if (product.sku) map.set(product.sku, product);
    if (product.barcode) map.set(product.barcode, product);
  });
  return map;
}

function classifyProducts(products, existingBySku) {
  const toCreate = [];
  const skippedExisting = [];

  products.forEach((product) => {
    const existing = existingBySku.get(product.sku);
    if (existing) {
      skippedExisting.push({
        sku: product.sku,
        name: product.name,
        existingId: existing.id,
        existingName: existing.name,
      });
      return;
    }

    toCreate.push(product);
  });

  return { toCreate, skippedExisting };
}

function printExceptionSummary(exceptions) {
  const grouped = exceptions.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});

  console.log('\nExceptions / warnings:');
  Object.entries(grouped).forEach(([type, count]) => {
    printSummary(type, count);
  });

  const samples = exceptions.slice(0, 12);
  if (samples.length) {
    console.log('\nSample exceptions:');
    samples.forEach((item) => {
      console.log(`- [${item.type}] ${item.name || item.identityKey || item.partNo || 'unknown'}${item.sourceRow ? ` (stock row ${item.sourceRow})` : ''}`);
    });
    if (exceptions.length > 12) {
      console.log(`... ${exceptions.length - 12} more exceptions`);
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is required');
  if (isExecute && !shouldConfirm) fail('Execute mode requires --confirm-import');

  console.log('\n=== JOSFAA Consolidated Product Import ===');
  printSummary('Mode', isDryRun ? 'DRY RUN' : 'EXECUTE');
  printSummary('Stocks source', stocksPath);
  printSummary('1st shipment source', firstShipmentPath);
  printSummary('2nd shipment source', secondShipmentPath);
  if (email) printSummary('Email', email);
  if (explicitTenantId) printSummary('Tenant override', explicitTenantId);
  if (explicitShopId) printSummary('Shop override', explicitShopId);
  if (explicitShopName) printSummary('Shop name', explicitShopName);

  validateSourcePaths();

  const stockRows = await parseStockRows(stocksPath);
  const firstShipmentRows = await parseShipmentRows(firstShipmentPath, 1);
  const secondShipmentRows = await parseShipmentRows(secondShipmentPath, 2);

  const firstShipmentMap = buildShipmentMap(firstShipmentRows, {
    qtyColumn: 'josfaaQty',
    wacColumn: 'wacGh',
    sellingPriceColumn: 'sp',
    sourceFile: firstShipmentPath,
    sourceLabel: 'first',
  });
  const secondShipmentMap = buildShipmentMap(secondShipmentRows, {
    qtyColumn: 'qty',
    wacColumn: 'wac',
    sellingPriceColumn: 'wsp',
    sourceFile: secondShipmentPath,
    sourceLabel: 'second',
  });

  const { products, exceptions } = consolidateProducts({
    stockRows,
    firstShipmentMap,
    secondShipmentMap,
  });

  const pricedProducts = products.filter((product) => product.costPrice > 0 || product.sellingPrice > 0);
  const zeroPriceProducts = products.length - pricedProducts.length;
  const bothShipmentProducts = products.filter((product) => product.metadata?.shipments?.first && product.metadata?.shipments?.second);

  console.log('\nSource counts:');
  printSummary('Stock rows parsed', stockRows.length);
  printSummary('1st shipment products', firstShipmentMap.size);
  printSummary('2nd shipment products', secondShipmentMap.size);
  printSummary('Consolidated products', products.length);
  printSummary('In both shipments', bothShipmentProducts.length);
  printSummary('With prices', pricedProducts.length);
  printSummary('Zero-price products', zeroPriceProducts);
  printExceptionSummary(exceptions);

  if (products.length) {
    console.log('\nSample consolidated products:');
    products.slice(0, 8).forEach((product) => {
      console.log(`- ${product.sku}: ${product.name} | cost=${product.costPrice} sell=${product.sellingPrice} stock=${product.quantityOnHand}`);
    });
  }

  try {
    await testConnection();
  } catch (error) {
    console.error(`\nDatabase connection failed: ${error.message}`);
    console.log('\nConsolidation preview completed, but tenant/shop resolution was skipped.');
    process.exitCode = 1;
    return;
  }

  let tenantContext;
  try {
    tenantContext = await resolveTenantTarget();
  } catch (error) {
    console.error(`\nTenant resolution failed: ${error.message}`);
    console.log('\nConsolidation preview completed, but tenant/shop could not be resolved in this database.');
    process.exitCode = 1;
    return;
  }

  const { user, tenant, tenantId, membershipRole } = tenantContext;
  let shop;
  try {
    shop = await resolveShop(tenantId);
  } catch (error) {
    console.error(`\nShop resolution failed: ${error.message}`);
    console.log('\nConsolidation preview completed, but target shop could not be resolved.');
    process.exitCode = 1;
    return;
  }

  const category = await loadCategory(tenantId);
  const existingBySku = await findExistingBySkus(tenantId, products.map((product) => product.sku));
  const { toCreate, skippedExisting } = classifyProducts(products, existingBySku);

  console.log('\nTarget:');
  if (user) printSummary('User', `${user.name || 'Unknown'} <${user.email}>`);
  printSummary('Tenant', `${tenant?.name || 'Unknown'} (${tenantId})`);
  printSummary('Tenant status', tenant?.status || 'unknown');
  if (membershipRole) printSummary('Membership role', membershipRole);
  printSummary('Shop', `${shop.name} (${shop.id})`);
  printSummary('Category', category ? `${category.name} (${category.id})` : `${CATEGORY_NAME} (would create)`);

  console.log('\nImport plan:');
  printSummary('Products to create', toCreate.length);
  printSummary('Existing SKUs skipped', skippedExisting.length);

  if (skippedExisting.length) {
    console.log('\nSample existing products skipped:');
    skippedExisting.slice(0, 10).forEach((item) => {
      console.log(`- ${item.sku}: ${item.name} (existing: ${item.existingName})`);
    });
  }

  if (toCreate.length) {
    console.log('\nSample products to create:');
    toCreate.slice(0, 8).forEach((product) => {
      console.log(`- ${product.sku}: ${product.name} | cost=${product.costPrice} sell=${product.sellingPrice} stock=${product.quantityOnHand}`);
    });
  }

  if (isDryRun) {
    console.log('\nDry run complete. No database changes made.');
    return;
  }

  const transaction = await sequelize.transaction();
  try {
    const resolvedCategory = category || await ensureCategory(tenantId, transaction);

    const records = toCreate.map((product) => ({
      tenantId,
      shopId: shop.id,
      name: product.name,
      sku: product.sku,
      description: product.name,
      brand: product.brand,
      categoryId: resolvedCategory.id,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      quantityOnHand: product.quantityOnHand,
      reorderLevel: 0,
      reorderQuantity: 0,
      unit: 'pcs',
      isActive: true,
      trackStock: true,
      hasVariants: false,
      metadata: product.metadata,
    }));

    if (records.length) {
      await Product.bulkCreate(records, { transaction, validate: true });
    }

    await transaction.commit();
    console.log(`\nImport completed. Created ${records.length} products${category ? '' : ` and category "${CATEGORY_NAME}"`}.`);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\nImport failed:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await sequelize.close();
    } catch (_error) {
      // Ignore close errors during CLI shutdown.
    }
  });
