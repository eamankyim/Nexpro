/**
 * Insert demo expense rows for the workspace of a user (default active tenant).
 *
 * Usage:
 *   cd Backend && node scripts/seed-expenses-for-tenant.js
 *   node scripts/seed-expenses-for-tenant.js nexuscreativestudios@gmail.com 10
 *
 * Amounts default to ₵100, ₵200, … ₵1000 for 10 rows (override with MIN/MAX via env or edit).
 * Requires DATABASE_URL in .env
 */
require('dotenv').config();

const { sequelize } = require('../config/database');
const { User, UserTenant, Tenant, Expense, Vendor } = require('../models');
const ExpenseActivity = require('../models/ExpenseActivity');
const expenseController = require('../controllers/expenseController');

const DEFAULT_OWNER_EMAIL = 'nexuscreativestudios@gmail.com';
const DEFAULT_COUNT = 10;

const CATEGORIES = [
  'Maintenance',
  'Supplies',
  'Utilities',
  'Marketing',
  'Transportation',
  'Equipment',
  'Labor',
  'Rent',
  'Office Supplies',
  'Other'
];

const DESCRIPTIONS = [
  'Toner and drum kit — HP series',
  'Paper stock (A4 reams)',
  'Electricity — studio meter',
  'Social media ad spend',
  'Delivery fuel and parking',
  'Blade replacement — cutter',
  'Contract labor — binding',
  'Workspace rent allocation',
  'Staples, tape, labels',
  'Misc. operational items'
];

const PAYMENT_METHODS = ['mobile_money', 'cash', 'bank_transfer'];

function parseArgs() {
  const a2 = process.argv[2];
  const a3 = process.argv[3];
  let email = DEFAULT_OWNER_EMAIL;
  let count = DEFAULT_COUNT;
  if (a2 && !/^\d+$/.test(a2)) email = String(a2).trim().toLowerCase();
  if (a3 && /^\d+$/.test(a3)) count = Math.min(100, Math.max(1, parseInt(a3, 10)));
  else if (a2 && /^\d+$/.test(a2)) count = Math.min(100, Math.max(1, parseInt(a2, 10)));
  return { email, count };
}

/**
 * Amount for row i when count rows span [minCedis, maxCedis] evenly.
 * @param {number} i
 * @param {number} count
 * @param {number} minCedis
 * @param {number} maxCedis
 */
function amountForIndex(i, count, minCedis, maxCedis) {
  if (count <= 1) return minCedis;
  const t = i / (count - 1);
  const v = minCedis + t * (maxCedis - minCedis);
  return Math.round(v * 100) / 100;
}

async function main() {
  const { email: ownerEmail, count } = parseArgs();
  const minCedis = parseFloat(process.env.SEED_EXPENSE_MIN || '100', 10);
  const maxCedis = parseFloat(process.env.SEED_EXPENSE_MAX || '1000', 10);

  await sequelize.authenticate();
  console.log('Database connected.\n');

  const user = await User.findOne({ where: { email: ownerEmail } });
  if (!user) throw new Error(`No user with email: ${ownerEmail}`);

  const userTenant = await UserTenant.findOne({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Tenant, as: 'tenant' }],
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']]
  });
  if (!userTenant?.tenant) throw new Error(`No active tenant for ${ownerEmail}`);

  const { tenant } = userTenant;
  const tenantId = tenant.id;

  const vendor = await Vendor.findOne({
    where: { tenantId },
    order: [['createdAt', 'ASC']]
  });

  console.log(`Owner: ${user.name} <${user.email}>`);
  console.log(`Tenant: ${tenant.name} (${tenantId})`);
  console.log(`Creating ${count} expenses (₵${minCedis}–₵${maxCedis} each)...\n`);

  const created = [];

  for (let i = 0; i < count; i++) {
    const transaction = await sequelize.transaction();
    try {
      const expenseNumber = await expenseController.generateExpenseNumber(tenantId, transaction);
      const amount = amountForIndex(i, count, minCedis, maxCedis);
      const category = CATEGORIES[i % CATEGORIES.length];
      const description = DESCRIPTIONS[i % DESCRIPTIONS.length];
      const paymentMethod = PAYMENT_METHODS[i % PAYMENT_METHODS.length];
      const now = new Date();
      now.setDate(now.getDate() - (count - 1 - i));

      const expense = await Expense.create(
        {
          tenantId,
          expenseNumber,
          category,
          description: `${description} (seed #${i + 1})`,
          amount,
          expenseDate: now,
          paymentMethod,
          status: 'paid',
          approvalStatus: 'approved',
          submittedBy: user.id,
          approvedBy: user.id,
          approvedAt: now,
          vendorId: vendor?.id || null,
          jobId: null,
          notes: null
        },
        { transaction }
      );

      try {
        await ExpenseActivity.create(
          {
            expenseId: expense.id,
            tenantId,
            type: 'creation',
            subject: 'Expense Created',
            notes: `Expense ${expense.expenseNumber} was seeded (approved)`,
            createdBy: user.id,
            metadata: { amount: expense.amount, category: expense.category, seeded: true }
          },
          { transaction }
        );
      } catch (e) {
        console.warn('Activity log skipped:', e.message);
      }

      await transaction.commit();
      created.push(expense.expenseNumber);
      process.stdout.write('.');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  console.log(`\n\nDone. Created ${created.length} expenses:`);
  created.forEach((n) => console.log(`  ${n}`));
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await sequelize.close();
  });
