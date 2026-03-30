/**
 * Delete a single user and related data by email.
 * Usage (from Backend directory):
 *   node scripts/delete-user-by-email.js eamankyim@gmail.com
 */

require('dotenv').config();

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
  Job,
  Quote,
  Expense,
  Lead,
  Sale,
  Prescription,
  FootTraffic,
  ExpiryAlert,
  JournalEntry,
} = require('../models');

const emailArg = process.argv[2];

if (!emailArg) {
  console.error('❌ Please provide an email address.\n');
  console.error('Example: node scripts/delete-user-by-email.js eamankyim@gmail.com');
  process.exit(1);
}

const normalizedEmail = String(emailArg).trim().toLowerCase();

async function deleteUserByEmail() {
  try {
    console.log(`🔍 Looking up user with email: ${normalizedEmail}`);

    await testConnection();

    const user = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      console.log('ℹ️  No user found with that email. Nothing to delete.');
      await sequelize.close();
      process.exit(0);
      return;
    }

    console.log('\n✅ User found:');
    console.log(`  ID:    ${user.id}`);
    console.log(`  Name:  ${user.name}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role:  ${user.role}`);
    console.log('');

    await sequelize.transaction(async (tx) => {
      const options = { transaction: tx };
      const userId = user.id;

      const del = async (Model, where) => {
        try {
          const count = await Model.destroy({ where, ...options });
          if (count > 0) {
            console.log(`  🗑️  ${Model.name}: deleted ${count} row(s)`);
          }
        } catch (err) {
          console.warn(`  ⚠️  Failed deleting from ${Model.name}: ${err.message}`);
        }
      };

      console.log('🧹 Deleting related data for this user...');

      // Memberships and collaboration data
      await del(UserTenant, { userId });

      // Tokens
      await del(InviteToken, { createdBy: userId });
      await del(InviteToken, { usedBy: userId });
      await del(PasswordResetToken, { userId });
      await del(EmailVerificationToken, { userId });

      // Notifications & personal productivity data
      await del(Notification, { userId });
      await del(Notification, { triggeredBy: userId });
      await del(UserTodo, { userId });
      await del(UserWeekFocus, { userId });
      await del(UserTask, { userId });
      await del(UserTask, { assigneeId: userId });
      await del(UserChecklist, { userId });
      await del(UserChecklistItem, { userId });

      // Domain entities where this user is directly referenced
      await del(Job, { assignedTo: userId });
      await del(Job, { createdBy: userId });
      await del(Quote, { createdBy: userId });
      await del(Expense, { submittedBy: userId });
      await del(Expense, { approvedBy: userId });
      await del(Lead, { assignedTo: userId });
      await del(Lead, { createdBy: userId });
      await del(Sale, { soldBy: userId });
      await del(Prescription, { filledBy: userId });
      await del(FootTraffic, { recordedBy: userId });
      await del(ExpiryAlert, { acknowledgedBy: userId });

      // Accounting references
      await del(JournalEntry, { createdBy: userId });
      await del(JournalEntry, { approvedBy: userId });

      console.log('\n👤 Deleting user record...');
      await user.destroy({ transaction: tx });
      console.log('✅ User deleted.');
    });

    await sequelize.close();
    console.log('\n🎉 Done.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

deleteUserByEmail();

