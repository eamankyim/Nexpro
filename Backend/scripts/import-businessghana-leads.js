/**
 * Import cleaned BusinessGhana leads from Cursor canvas lead sheets.
 *
 * Usage:
 *   cd Backend
 *   node scripts/import-businessghana-leads.js
 *   node scripts/import-businessghana-leads.js --email icreationsghana@gmail.com --studio-name "ABS Management Leads"
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Lead,
  StudioLocation,
  Tenant,
  User,
  UserStudioLocation,
  UserTenant,
} = require('../models');

const DEFAULT_OWNER_EMAIL = 'icreationsghana@gmail.com';
const DEFAULT_STUDIO_NAME = 'ABS Management Leads';
const SOURCE = 'BusinessGhana Directory';
const DEFAULT_CANVAS_PATHS = [
  '/Users/us/.cursor/projects/Users-us-Desktop-Development-Nexpro/canvases/ghana-food-pub-leads.canvas.tsx',
  '/Users/us/.cursor/projects/Users-us-Desktop-Development-Nexpro/canvases/ghana-restaurant-leads-list-2.canvas.tsx',
];

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    email: DEFAULT_OWNER_EMAIL,
    studioName: DEFAULT_STUDIO_NAME,
    canvasPaths: [...DEFAULT_CANVAS_PATHS],
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--email') parsed.email = String(args[++i] || '').trim().toLowerCase();
    else if (arg === '--studio-name') parsed.studioName = String(args[++i] || '').trim();
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

  const start = source.indexOf('[', markerIndex);
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

function normalizePhone(phone) {
  const value = String(phone || '').trim();
  if (!value || /^n\/?a$/i.test(value)) return null;
  return value;
}

function toLeadRow(lead, { tenantId, studioLocationId, userId }) {
  const businessName = String(lead.name || '').trim();
  const location = String(lead.location || '').trim();
  const category = String(lead.category || '').trim();
  const description = String(lead.description || '').trim();

  return {
    tenantId,
    studioLocationId,
    name: businessName,
    company: businessName,
    phone: normalizePhone(lead.phone),
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
      rawPriority: lead.priority || null,
    },
    isActive: true,
  };
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
  const { email, studioName, canvasPaths, dryRun } = parseArgs();
  await sequelize.authenticate();

  const { user, tenant } = await getTenantForOwner(email);
  const { studioLocation, created: studioCreated } = await getOrCreateStudioLocation({
    tenantId: tenant.id,
    studioName,
    user,
  });

  const loadedLeads = canvasPaths.flatMap((canvasPath) => {
    if (!fs.existsSync(canvasPath)) throw new Error(`Canvas not found: ${canvasPath}`);
    return loadLeadsFromCanvas(canvasPath);
  });

  const uniqueRows = [];
  const seenIncoming = new Set();
  for (const lead of loadedLeads) {
    const key = normalizeKey(lead.name);
    if (!key || seenIncoming.has(key)) continue;
    seenIncoming.add(key);
    uniqueRows.push(toLeadRow(lead, {
      tenantId: tenant.id,
      studioLocationId: studioLocation.id,
      userId: user.id,
    }));
  }

  const existingLeads = await Lead.findAll({
    where: {
      tenantId: tenant.id,
      [Op.or]: [
        { source: SOURCE },
        { company: { [Op.in]: uniqueRows.map((row) => row.company) } },
        { name: { [Op.in]: uniqueRows.map((row) => row.name) } },
      ],
    },
    attributes: ['name', 'company'],
  });

  const existingKeys = new Set(
    existingLeads.flatMap((lead) => [normalizeKey(lead.name), normalizeKey(lead.company)]).filter(Boolean)
  );
  const rowsToCreate = uniqueRows.filter((row) => !existingKeys.has(normalizeKey(row.company)));

  console.log(`Owner: ${user.name} <${user.email}>`);
  console.log(`Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`Studio location: ${studioLocation.name} (${studioLocation.id})${studioCreated ? ' [created]' : ''}`);
  console.log(`Loaded leads: ${loadedLeads.length}`);
  console.log(`Unique incoming leads: ${uniqueRows.length}`);
  console.log(`Existing matches skipped: ${uniqueRows.length - rowsToCreate.length}`);
  console.log(`Ready to insert: ${rowsToCreate.length}`);

  if (dryRun) {
    console.log('Dry run only. No leads inserted.');
    return;
  }

  const created = await Lead.bulkCreate(rowsToCreate, {
    individualHooks: true,
    validate: true,
  });

  console.log(`Inserted ${created.length} leads.`);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
