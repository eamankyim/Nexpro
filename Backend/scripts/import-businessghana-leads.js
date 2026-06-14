/**
 * Import cleaned BusinessGhana leads into a tenant studio location.
 *
 * Usage:
 *   cd Backend
 *   node scripts/import-businessghana-leads.js --email icreationsghana@gmail.com --dry-run
 *   node scripts/import-businessghana-leads.js --email icreationsghana@gmail.com --studio-name "ABS Management"
 *   node scripts/import-businessghana-leads.js --data-file scripts/data/businessghana-leads.json
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { formatToE164 } = require('../utils/phoneUtils');
const {
  Lead,
  StudioLocation,
  Tenant,
  User,
  UserStudioLocation,
  UserTenant,
} = require('../models');

const DEFAULT_OWNER_EMAIL = 'icreationsghana@gmail.com';
const DEFAULT_STUDIO_NAME = 'ABS Management';
const SOURCE = 'BusinessGhana Directory';
const DEFAULT_DATA_FILE = path.join(__dirname, 'data', 'businessghana-leads.json');

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    email: DEFAULT_OWNER_EMAIL,
    studioName: DEFAULT_STUDIO_NAME,
    dataFile: DEFAULT_DATA_FILE,
    canvasPaths: [],
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email') parsed.email = String(args[++i] || '').trim().toLowerCase();
    else if (arg === '--studio-name') parsed.studioName = String(args[++i] || '').trim();
    else if (arg === '--data-file') parsed.dataFile = path.resolve(args[++i] || '');
    else if (arg === '--canvas') parsed.canvasPaths.push(path.resolve(args[++i] || ''));
    else if (arg === '--dry-run') parsed.dryRun = true;
  }

  if (!parsed.email) throw new Error('Owner email is required.');
  if (!parsed.studioName) throw new Error('Studio name is required.');
  return parsed;
}

function extractArrayLiteral(source, filePath) {
  const marker = 'const leads';
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Could not find leads array in ${filePath}`);

  const equalsIndex = source.indexOf('=', markerIndex);
  const start = source.indexOf('[', equalsIndex);
  if (start === -1) throw new Error(`Could not find leads array start in ${filePath}`);

  let depth = 0;
  let inString = false;
  let stringQuote = '';
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === stringQuote) inString = false;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      inString = true;
      stringQuote = char;
      continue;
    }

    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }

  throw new Error(`Could not find leads array end in ${filePath}`);
}

function loadLeadsFromCanvas(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const arrayLiteral = extractArrayLiteral(source, filePath);
  return vm.runInNewContext(arrayLiteral, {}, { timeout: 1000 });
}

function loadLeadsFromJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Lead data file not found: ${filePath}`);
  }
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const leads = Array.isArray(payload) ? payload : payload.leads;
  if (!Array.isArray(leads) || leads.length === 0) {
    throw new Error(`No leads found in ${filePath}`);
  }
  return leads;
}

function loadLeads({ dataFile, canvasPaths }) {
  if (canvasPaths.length > 0) {
    return canvasPaths.flatMap((canvasPath) => {
      if (!fs.existsSync(canvasPath)) throw new Error(`Canvas not found: ${canvasPath}`);
      return loadLeadsFromCanvas(canvasPath);
    });
  }
  return loadLeadsFromJson(dataFile);
}

function normalizeKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizePriority(priority) {
  const value = String(priority || '').toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function extractPrimaryPhone(rawPhone) {
  const value = String(rawPhone || '').trim();
  if (!value || /^n\/?a$/i.test(value)) return null;

  const candidates = value
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const e164 = formatToE164(candidate);
    if (e164) return e164;
  }

  const fallback = candidates[0] || value;
  return fallback.length <= 100 ? fallback : fallback.slice(0, 100);
}

function toLeadRow(lead, { tenantId, studioLocationId, userId, phone }) {
  const businessName = String(lead.name || '').trim();
  const location = String(lead.location || '').trim();
  const category = String(lead.category || '').trim();
  const description = String(lead.description || '').trim();
  const rawPhone = String(lead.phone || '').trim();

  return {
    tenantId,
    studioLocationId,
    name: businessName,
    company: businessName,
    phone,
    email: null,
    source: SOURCE,
    status: 'new',
    priority: normalizePriority(lead.priority),
    assignedTo: userId,
    createdBy: userId,
    notes: [
      description && `Description: ${description}`,
      category && `Category: ${category}`,
      location && location !== 'Not listed' && `Location: ${location}`,
      rawPhone && rawPhone !== phone && `All listed phones: ${rawPhone}`,
      phone == null && rawPhone && 'Phone omitted because another lead in this tenant already uses the primary number.',
      'Imported from cleaned BusinessGhana restaurant/pub directory leads.',
    ].filter(Boolean).join('\n'),
    tags: [
      'businessghana',
      'restaurant-leads',
      category.toLowerCase().includes('pub') || category.toLowerCase().includes('bar') ? 'pub-bar' : 'restaurant',
    ],
    metadata: {
      importedFrom: 'BusinessGhana',
      importedByScript: 'scripts/import-businessghana-leads.js',
      businessName,
      category,
      location,
      rawPhone: lead.phone || null,
      primaryPhone: phone,
      rawPriority: lead.priority || null,
    },
    isActive: true,
  };
}

function assignImportPhones(leads, reservedPhones = new Set()) {
  const usedPhones = new Set(reservedPhones);
  const rows = [];
  let duplicatePhonesSkipped = 0;

  for (const lead of leads) {
    const primaryPhone = extractPrimaryPhone(lead.phone);
    const phone = primaryPhone && !usedPhones.has(primaryPhone) ? primaryPhone : null;
    if (primaryPhone && phone == null) duplicatePhonesSkipped += 1;
    if (phone) usedPhones.add(phone);
    rows.push({ lead, phone });
  }

  return { rows, duplicatePhonesSkipped };
}

function formatInsertError(error) {
  return error?.parent?.detail
    || error?.parent?.message
    || error?.errors?.map((item) => item.message).join('; ')
    || error?.message
    || String(error);
}

async function getTenantForOwner(ownerEmail) {
  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) throw new Error(`No user found for ${ownerEmail}`);

  const userTenant = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant' }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });

  if (!userTenant?.tenant) throw new Error(`No active tenant found for ${ownerEmail}`);
  return { user, tenant: userTenant.tenant };
}

async function getOrCreateStudioLocation({ tenantId, studioName, user }) {
  const [studioLocation, created] = await StudioLocation.findOrCreate({
    where: { tenantId, name: studioName },
    defaults: {
      tenantId,
      name: studioName,
      studioType: 'lead_management',
      code: normalizeKey(studioName).replace(/\s+/g, '-').slice(0, 64) || null,
      country: 'Ghana',
      managerName: user.name,
      managerUserId: user.id,
      isActive: true,
      isDefault: false,
      metadata: { createdFor: 'BusinessGhana lead import' },
    },
  });

  await UserStudioLocation.findOrCreate({
    where: { userId: user.id, tenantId, studioLocationId: studioLocation.id },
    defaults: { userId: user.id, tenantId, studioLocationId: studioLocation.id },
  });

  return { studioLocation, created };
}

async function main() {
  const { email, studioName, dataFile, canvasPaths, dryRun } = parseArgs();
  await sequelize.authenticate();

  const { user, tenant } = await getTenantForOwner(email);
  const { studioLocation, created: studioCreated } = await getOrCreateStudioLocation({
    tenantId: tenant.id,
    studioName,
    user,
  });

  const loadedLeads = loadLeads({ dataFile, canvasPaths });

  const uniqueIncoming = [];
  const seenIncoming = new Set();
  for (const lead of loadedLeads) {
    const key = normalizeKey(lead.name);
    if (!key || seenIncoming.has(key)) continue;
    seenIncoming.add(key);
    uniqueIncoming.push(lead);
  }

  const existingLeads = await Lead.findAll({
    where: {
      tenantId: tenant.id,
      [Op.or]: [
        { source: SOURCE },
        { company: { [Op.in]: uniqueIncoming.map((lead) => String(lead.name || '').trim()) } },
        { name: { [Op.in]: uniqueIncoming.map((lead) => String(lead.name || '').trim()) } },
      ],
    },
    attributes: ['name', 'company', 'phone'],
  });

  const existingKeys = new Set(
    existingLeads.flatMap((lead) => [normalizeKey(lead.name), normalizeKey(lead.company)]).filter(Boolean)
  );
  const reservedPhones = new Set(
    existingLeads.map((lead) => String(lead.phone || '').trim()).filter(Boolean)
  );

  const leadsToImport = uniqueIncoming.filter((lead) => !existingKeys.has(normalizeKey(lead.name)));
  const { rows: phoneAssignments, duplicatePhonesSkipped } = assignImportPhones(leadsToImport, reservedPhones);
  const rowsToCreate = phoneAssignments.map(({ lead, phone }) => toLeadRow(lead, {
    tenantId: tenant.id,
    studioLocationId: studioLocation.id,
    userId: user.id,
    phone,
  }));

  console.log(`Owner: ${user.name} <${user.email}>`);
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Studio location: ${studioLocation.name} (${studioLocation.id})${studioCreated ? ' [created]' : ''}`);
  console.log(`Data source: ${canvasPaths.length > 0 ? canvasPaths.join(', ') : dataFile}`);
  console.log(`Loaded leads: ${loadedLeads.length}`);
  console.log(`Unique incoming leads: ${uniqueIncoming.length}`);
  console.log(`Existing matches skipped: ${uniqueIncoming.length - leadsToImport.length}`);
  console.log(`Duplicate phones kept in notes only: ${duplicatePhonesSkipped}`);
  console.log(`Ready to insert: ${rowsToCreate.length}`);

  if (dryRun) {
    console.log('Dry run only. No leads inserted.');
    return;
  }

  let inserted = 0;
  const failures = [];

  for (const row of rowsToCreate) {
    try {
      await Lead.create(row);
      inserted += 1;
    } catch (error) {
      failures.push({ name: row.name, message: formatInsertError(error) });
    }
  }

  console.log(`Inserted ${inserted} leads.`);
  if (failures.length > 0) {
    console.log(`Failed ${failures.length} leads:`);
    failures.slice(0, 20).forEach((failure) => {
      console.log(`- ${failure.name}: ${failure.message}`);
    });
    if (failures.length > 20) {
      console.log(`... and ${failures.length - 20} more`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
