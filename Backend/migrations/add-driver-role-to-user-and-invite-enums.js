const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const DRIVER_ROLE = 'driver';

const discoverEnumTypesForColumn = async (tableName, columnName, fallbackTypeNames = []) => {
  const [rows] = await sequelize.query(
    `
      SELECT DISTINCT udt_name AS typname
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = :tableName
        AND column_name = :columnName
        AND udt_name IS NOT NULL;
    `,
    { replacements: { tableName, columnName } }
  );

  const discovered = (rows || []).map((row) => row.typname).filter(Boolean);
  return [...new Set([...fallbackTypeNames, ...discovered])];
};

const ensureEnumHasDriverValue = async (typeName) => {
  const [[typeRow]] = await sequelize.query(
    `SELECT oid FROM pg_type WHERE typname = :typeName LIMIT 1`,
    { replacements: { typeName } }
  );
  if (!typeRow?.oid) {
    console.log(`   ⏭️  ${typeName}: type not found`);
    return;
  }

  const [[hasDriver]] = await sequelize.query(
    `SELECT 1 AS ok FROM pg_enum WHERE enumtypid = :oid AND enumlabel = :role LIMIT 1`,
    { replacements: { oid: typeRow.oid, role: DRIVER_ROLE } }
  );
  if (hasDriver?.ok) {
    console.log(`   ✓ ${typeName}: driver already present`);
    return;
  }

  await sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE '${DRIVER_ROLE}'`);
  console.log(`   ➕ ${typeName}: added ${DRIVER_ROLE}`);
};

const addDriverRoleToUserAndInviteEnums = async (options = {}) => {
  const { closeConnection = true } = options;
  console.log('🏗️  Ensuring driver role exists in users/invite_tokens enum types...');

  try {
    const userRoleTypes = await discoverEnumTypesForColumn('users', 'role', ['enum_users_role']);
    const inviteRoleTypes = await discoverEnumTypesForColumn('invite_tokens', 'role', ['enum_invite_tokens_role']);
    const allTypeNames = [...new Set([...userRoleTypes, ...inviteRoleTypes])];

    for (const typeName of allTypeNames) {
      // ALTER TYPE ... ADD VALUE cannot run inside transaction on some PG versions.
      await ensureEnumHasDriverValue(typeName);
    }

    console.log('✅ Driver role enum migration complete');
  } catch (error) {
    console.error('💥 Failed to add driver role to enums:', error);
    throw error;
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  addDriverRoleToUserAndInviteEnums({ closeConnection: true })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addDriverRoleToUserAndInviteEnums;
