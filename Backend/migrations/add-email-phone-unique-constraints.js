const { sequelize } = require('../config/database');
const { formatToE164 } = require('../utils/phoneUtils');

/**
 * Migration: Email case-insensitivity and global uniqueness for email/phone
 * 1. Normalize existing emails to lowercase
 * 2. Normalize existing phones to E.164 where possible
 * 3. Add unique constraints (globally across tenants) for email and phone
 */
const addEmailPhoneUniqueConstraints = async () => {
  console.log('📧 Adding email/phone case-insensitivity and uniqueness...');
  let transaction;

  try {
    transaction = await sequelize.transaction();

    // 1. Normalize users.email to lowercase
    console.log('  ➡️  Normalizing users.email to lowercase...');
    await sequelize.query(`
      UPDATE users SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL AND email != '';
    `, { transaction });

    // 2. Normalize invite_tokens.email to lowercase
    console.log('  ➡️  Normalizing invite_tokens.email to lowercase...');
    try {
      await sequelize.query(`
        UPDATE invite_tokens SET email = LOWER(TRIM(email)) WHERE email IS NOT NULL AND email != '';
      `, { transaction });
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // 3. Normalize customers
    console.log('  ➡️  Normalizing customers email and phone...');
    const [customers] = await sequelize.query(
      "SELECT id, email, phone FROM customers WHERE (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')",
      { transaction }
    );
    for (const row of customers) {
      const updates = [];
      const params = { id: row.id };
      if (row.email) {
        updates.push('email = LOWER(TRIM(:email))');
        params.email = row.email;
      }
      if (row.phone) {
        const e164 = formatToE164(row.phone);
        if (e164) {
          updates.push('phone = :phoneE164');
          params.phoneE164 = e164;
        } else {
          updates.push('phone = TRIM(:phone)');
          params.phone = row.phone;
        }
      }
      if (updates.length) {
        const setClause = updates.join(', ');
        const q = `UPDATE customers SET ${setClause} WHERE id = :id`;
        await sequelize.query(q, { replacements: params, transaction });
      }
    }

    // 4. Normalize vendors
    console.log('  ➡️  Normalizing vendors email and phone...');
    try {
      const [vendors] = await sequelize.query(
        "SELECT id, email, phone FROM vendors WHERE (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')",
        { transaction }
      );
      for (const row of vendors) {
        const updates = [];
        const params = { id: row.id };
        if (row.email) {
          updates.push('email = LOWER(TRIM(:email))');
          params.email = row.email;
        }
        if (row.phone) {
          const e164 = formatToE164(row.phone);
          if (e164) {
            updates.push('phone = :phoneE164');
            params.phoneE164 = e164;
          } else {
            updates.push('phone = TRIM(:phone)');
            params.phone = row.phone;
          }
        }
        if (updates.length) {
          const setClause = updates.join(', ');
          await sequelize.query(`UPDATE vendors SET ${setClause} WHERE id = :id`, { replacements: params, transaction });
        }
      }
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // 5. Normalize leads
    console.log('  ➡️  Normalizing leads email and phone...');
    try {
      const [leads] = await sequelize.query(
        "SELECT id, email, phone FROM leads WHERE (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')",
        { transaction }
      );
      for (const row of leads) {
        const updates = [];
        const params = { id: row.id };
        if (row.email) {
          updates.push('email = LOWER(TRIM(:email))');
          params.email = row.email;
        }
        if (row.phone) {
          const e164 = formatToE164(row.phone);
          if (e164) {
            updates.push('phone = :phoneE164');
            params.phoneE164 = e164;
          } else {
            updates.push('phone = TRIM(:phone)');
            params.phone = row.phone;
          }
        }
        if (updates.length) {
          const setClause = updates.join(', ');
          await sequelize.query(`UPDATE leads SET ${setClause} WHERE id = :id`, { replacements: params, transaction });
        }
      }
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // 6. Normalize employees
    console.log('  ➡️  Normalizing employees email and phone...');
    try {
      const [employees] = await sequelize.query(
        "SELECT id, email, phone FROM employees WHERE (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')",
        { transaction }
      );
      for (const row of employees) {
        const updates = [];
        const params = { id: row.id };
        if (row.email) {
          updates.push('email = LOWER(TRIM(:email))');
          params.email = row.email;
        }
        if (row.phone) {
          const e164 = formatToE164(row.phone);
          if (e164) {
            updates.push('phone = :phoneE164');
            params.phoneE164 = e164;
          } else {
            updates.push('phone = TRIM(:phone)');
            params.phone = row.phone;
          }
        }
        if (updates.length) {
          const setClause = updates.join(', ');
          await sequelize.query(`UPDATE employees SET ${setClause} WHERE id = :id`, { replacements: params, transaction });
        }
      }
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    await transaction.commit();
    transaction = null;

    // 7. Add unique indexes (globally unique across tenants)
    // Run outside transaction so one failure doesn't abort others
    const tryUniqueIndex = async (name, sql) => {
      try {
        await sequelize.query(sql);
      } catch (e) {
        if (e.code === '23505' || e.parent?.code === '23505' || e.message?.includes('duplicate key') || e.name === 'SequelizeUniqueConstraintError') {
          console.warn(`  ⚠️  Skipped ${name}: duplicate values exist. Resolve duplicates and re-run migration to enforce.`);
        } else {
          throw e;
        }
      }
    };

    console.log('  ➡️  Adding unique constraints...');

    // Customers
    await tryUniqueIndex('idx_customers_email_unique', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique
      ON customers (LOWER(TRIM(email)))
      WHERE email IS NOT NULL AND TRIM(email) != '';
    `);
    await tryUniqueIndex('idx_customers_phone_unique', `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique
      ON customers (TRIM(phone))
      WHERE phone IS NOT NULL AND TRIM(phone) != '';
    `);

    // Vendors
    try {
      await tryUniqueIndex('idx_vendors_email_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_email_unique
        ON vendors (LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('idx_vendors_phone_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_phone_unique
        ON vendors (TRIM(phone))
        WHERE phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Leads
    try {
      await tryUniqueIndex('idx_leads_email_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_email_unique
        ON leads (LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('idx_leads_phone_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_unique
        ON leads (TRIM(phone))
        WHERE phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    // Employees
    try {
      await tryUniqueIndex('idx_employees_email_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique
        ON employees (LOWER(TRIM(email)))
        WHERE email IS NOT NULL AND TRIM(email) != '';
      `);
      await tryUniqueIndex('idx_employees_phone_unique', `
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_phone_unique
        ON employees (TRIM(phone))
        WHERE phone IS NOT NULL AND TRIM(phone) != '';
      `);
    } catch (e) {
      if (!e.message?.includes('does not exist')) throw e;
    }

    console.log('✅ Email/phone normalization and uniqueness constraints applied');
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('❌ Error in add-email-phone-unique-constraints:', error.message);
    if (error.message?.includes('duplicate key') || error.code === '23505') {
      console.error('   Duplicate email or phone found. Resolve duplicates before re-running migration.');
    }
    throw error;
  }
};

if (require.main === module) {
  addEmailPhoneUniqueConstraints()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = addEmailPhoneUniqueConstraints;
