/**
 * Insert N demo customers for the workspace owned by a user email (default tenant membership).
 *
 * Usage:
 *   cd Backend && node scripts/seed-customers-for-tenant.js
 *   node scripts/seed-customers-for-tenant.js nexuscreativestudios@gmail.com 50
 *
 * Requires DATABASE_URL in .env
 */
require('dotenv').config();

const { sequelize } = require('../config/database');
const { User, UserTenant, Tenant, Customer } = require('../models');
const { Op } = require('sequelize');

const DEFAULT_OWNER_EMAIL = 'nexuscreativestudios@gmail.com';
const DEFAULT_COUNT = 50;

const FIRST_NAMES = [
  'Kwame', 'Ama', 'Kofi', 'Akosua', 'Yaw', 'Efua', 'Kojo', 'Abena', 'Kwaku', 'Adwoa',
  'Kwabena', 'Yaa', 'Fiifi', 'Akua', 'Kweku', 'Afua', 'Nana', 'Esi', 'Yaw', 'Maame',
  'Selorm', 'Enyonam', 'Elikem', 'Delali', 'Kekeli', 'Mawuli', 'Senyo', 'Abla', 'Edem', 'Kafui'
];

const LAST_NAMES = [
  'Mensah', 'Osei', 'Asante', 'Boateng', 'Owusu', 'Appiah', 'Darko', 'Agyeman', 'Amoah', 'Bonsu',
  'Danso', 'Frimpong', 'Gyasi', 'Kwarteng', 'Manu', 'Sarpong', 'Tetteh', 'Adjei', 'Nkrumah', 'Quaye',
  'Acheampong', 'Antwi', 'Bediako', 'Cudjoe', 'Domfeh', 'Entsua', 'Fynn', 'Gaisie', 'Hagan', 'Issah'
];

const COMPANY_PREFIXES = [
  'Nexus Client', 'Creative Hub', 'Studio Partner', 'Print Co', 'Design Works', 'Media House',
  'Brand Lab', 'Visual Co', 'Pixel Agency', 'Frame Studio'
];

const GHANA_AREAS = [
  'Adenta', 'East Legon', 'Osu', 'Tema Community 5', 'Spintex', 'Dansoman', 'Ashaiman',
  'Madina', 'Haatso', 'Labone', 'Cantonments', 'North Kaneshie', 'Kasoa', 'Teshie', 'Nungua'
];

const SOURCES = ['Walk-in', 'Referral', 'Social Media', 'Signboard', 'Market Outreach'];

const GH_PREFIXES = ['020', '024', '026', '027', '050', '054', '055', '056', '059'];

function pick(arr, i) {
  return arr[i % arr.length];
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function parseArgs() {
  const emailArg = process.argv[2];
  const countArg = process.argv[3];
  const email = (emailArg && !/^\d+$/.test(emailArg) ? emailArg : DEFAULT_OWNER_EMAIL).trim().toLowerCase();
  let count = DEFAULT_COUNT;
  if (countArg && /^\d+$/.test(countArg)) {
    count = Math.min(500, Math.max(1, parseInt(countArg, 10)));
  } else if (emailArg && /^\d+$/.test(emailArg)) {
    count = Math.min(500, Math.max(1, parseInt(emailArg, 10)));
  }
  return { email, count };
}

async function main() {
  const { email: ownerEmail, count } = parseArgs();

  await sequelize.authenticate();
  console.log('Database connected.\n');

  const user = await User.findOne({
    where: { email: ownerEmail }
  });

  if (!user) {
    throw new Error(`No user with email: ${ownerEmail}`);
  }

  const userTenant = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant' }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
  });

  if (!userTenant?.tenant) {
    throw new Error(`No active tenant membership for ${ownerEmail}`);
  }

  const { tenant } = userTenant;
  const tenantId = tenant.id;

  console.log(`Owner: ${user.name} <${user.email}>`);
  console.log(`Tenant: ${tenant.name} (${tenantId})`);
  console.log(`Creating ${count} customers...\n`);

  const stamp = Date.now();
  const rows = [];

  for (let i = 0; i < count; i++) {
    const fn = pick(FIRST_NAMES, i * 3);
    const ln = pick(LAST_NAMES, i * 5 + 7);
    const name = `${fn} ${ln}`;
    const source = pick(SOURCES, i);
    const area = pick(GHANA_AREAS, i + 11);
    const prefix = pick(GH_PREFIXES, i);
    const localDigits = String(1000000 + ((stamp + i) % 8999999)).padStart(7, '0');
    const phone = `${prefix}${localDigits}`;
    const emailLocal = `seed.${stamp}.${i}`;
    const company =
      i % 4 === 0
        ? `${pick(COMPANY_PREFIXES, i)} ${ln}`
        : i % 4 === 1
          ? `${ln} Enterprises`
          : '';

    rows.push({
      tenantId,
      name,
      company: company || null,
      email: `${emailLocal}@customer.seed.local`,
      phone,
      address: `House ${(i % 40) + 1}, ${area}`,
      city: pick(['Accra', 'Tema', 'Kasoa'], i),
      state: pick(['Greater Accra', 'Central'], i),
      country: 'Ghana',
      howDidYouHear: source,
      referralName: source === 'Referral' ? `${pick(FIRST_NAMES, i + 2)} ${pick(LAST_NAMES, i + 3)}` : null,
      balance: i % 7 === 0 ? (Math.round((i % 5) * 12.5 * 100) / 100).toFixed(2) : '0.00',
      notes: i % 5 === 0 ? 'Seeded demo customer' : null,
      isActive: true
    });
  }

  const created = await Customer.bulkCreate(rows, { individualHooks: true, validate: true });

  console.log(`Done. Inserted ${created.length} customers for tenant "${tenant.name}".`);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
