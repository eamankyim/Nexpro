/**
 * Delete users by email (safe for demo DB missing optional tables).
 * Usage: node scripts/delete-users-by-emails.js email1@x.com email2@x.com
 *        CONFIRM_DELETE=yes node scripts/delete-users-by-emails.js --file emails.txt
 */

require('dotenv').config();

const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../config/database');
const {
  User,
  UserTenant,
  InviteToken,
  PasswordResetToken,
  EmailVerificationToken,
  Notification,
  UserTodo,
  UserWeekFocus,
  UserTask,
  UserChecklist,
  UserChecklistItem,
  PlatformAdminUserRole,
} = require('../models');

const confirmDelete = process.env.CONFIRM_DELETE === 'yes';

const DEFAULT_EMAILS = [
  'eamankyim@gmail3.com',
  'eamankyim4@gmail.com',
  'icreationsghana2@gmail.com',
  'fansah@gmail.com',
  'eanane@gmail.com',
  'eamankyim@inovtechsc.com',
  'eamankyim3@gmail.com',
  'test-shop-pharmacy@example.com',
  'nexprotesting@gmail.com',
  '22222282@email.com',
  'ekwofie@gmail.com',
];

/**
 * @param {typeof import('sequelize').Model} Model
 * @param {object} where
 */
async function safeDestroy(Model, where) {
  try {
    return await Model.destroy({ where });
  } catch (err) {
    const msg = err?.message || '';
    if (msg.includes('does not exist') || msg.includes('relation')) {
      return 0;
    }
    throw err;
  }
}

function parseEmails(argv) {
  if (argv.includes('--file')) {
    const path = argv[argv.indexOf('--file') + 1];
    return fs
      .readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((l) => l.trim().toLowerCase())
      .filter((l) => l && l.includes('@'));
  }
  const fromArgs = argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return fromArgs.length ? fromArgs : DEFAULT_EMAILS;
}

async function deleteOneUser(email) {
  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.log(`  ℹ️  ${email} — not found`);
    return { email, status: 'missing' };
  }

  const memberships = await UserTenant.count({ where: { userId: user.id } });
  if (memberships > 0) {
    console.log(`  ⏭️  ${email} — skipped (has ${memberships} workspace membership(s))`);
    return { email, status: 'skipped' };
  }

  if (user.isPlatformAdmin) {
    console.log(`  ⏭️  ${email} — skipped (platform admin)`);
    return { email, status: 'skipped' };
  }

  await safeDestroy(InviteToken, { createdBy: user.id });
  await safeDestroy(InviteToken, { usedBy: user.id });
  await safeDestroy(PasswordResetToken, { userId: user.id });
  await safeDestroy(EmailVerificationToken, { userId: user.id });
  await safeDestroy(PlatformAdminUserRole, { userId: user.id });
  await safeDestroy(Notification, { userId: user.id });
  await safeDestroy(Notification, { triggeredBy: user.id });
  await safeDestroy(UserTodo, { userId: user.id });
  await safeDestroy(UserWeekFocus, { userId: user.id });
  await safeDestroy(UserTask, { userId: user.id });
  await safeDestroy(UserTask, { assigneeId: user.id });
  await safeDestroy(UserChecklist, { userId: user.id });
  await safeDestroy(UserChecklistItem, { userId: user.id });

  await user.destroy();
  console.log(`  ✅ ${email} — deleted (${user.name})`);
  return { email, status: 'deleted' };
}

async function main() {
  const emails = parseEmails(process.argv);
  await testConnection();

  const host = (process.env.DATABASE_URL || '').match(/@([^/?]+)/)?.[1] || 'unknown';
  console.log(`\n🗑️  Delete ${emails.length} user(s) from ${host}\n`);
  emails.forEach((e) => console.log(`   - ${e}`));

  if (!confirmDelete) {
    console.log('\n⚠️  Dry run. To delete: CONFIRM_DELETE=yes node scripts/delete-users-by-emails.js\n');
    const users = await User.findAll({
      where: { email: { [Op.in]: emails } },
      attributes: ['email', 'name'],
    });
    console.log(`Found ${users.length} matching user(s) in DB.\n`);
    await sequelize.close();
    return;
  }

  const results = [];
  for (const email of emails) {
    results.push(await deleteOneUser(email));
  }

  const deleted = results.filter((r) => r.status === 'deleted').length;
  console.log(`\n✅ Done. Deleted ${deleted} user(s).\n`);
  await sequelize.close();
}

main().catch(async (err) => {
  console.error('❌', err.message || err);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
