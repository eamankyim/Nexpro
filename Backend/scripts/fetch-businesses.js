require('dotenv').config();
const { sequelize, testConnection } = require('../config/database');
const { Tenant, UserTenant } = require('../models');

const fetchBusinesses = async () => {
  try {
    await testConnection();
    console.log('Fetching all businesses (tenants) from DB...\n');

    const tenants = await Tenant.findAll({
      attributes: [
        'id',
        'name',
        'slug',
        'description',
        'status',
        'plan',
        'businessType',
        'metadata',
        'trialEndsAt',
        'billingCustomerId',
        'createdAt',
        'updatedAt'
      ],
      include: [
        {
          model: UserTenant,
          as: 'memberships',
          attributes: ['userId', 'role', 'status', 'isDefault', 'joinedAt'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    if (tenants.length === 0) {
      console.log('No businesses found.\n');
      await sequelize.close();
      process.exit(0);
      return;
    }

    console.log(`Found ${tenants.length} business(es):\n`);
    tenants.forEach((t, i) => {
      const row = t.toJSON();
      const meta = row.metadata || {};
      console.log('---');
      console.log(`[${i + 1}] id: ${row.id}`);
      console.log(`    name: ${row.name}`);
      console.log(`    slug: ${row.slug}`);
      console.log(`    description: ${row.description ?? '(null)'}`);
      console.log(`    status: ${row.status}`);
      console.log(`    plan: ${row.plan}`);
      console.log(`    businessType: ${row.businessType ?? '(null)'}`);
      console.log(`    trialEndsAt: ${row.trialEndsAt ?? '(null)'}`);
      console.log(`    billingCustomerId: ${row.billingCustomerId ?? '(null)'}`);
      console.log(`    createdAt: ${row.createdAt}`);
      console.log(`    updatedAt: ${row.updatedAt}`);
      console.log('    metadata:');
      console.log(JSON.stringify(meta, null, 8).replace(/^/gm, '      '));
      if (row.memberships && row.memberships.length) {
        console.log(`    memberships (${row.memberships.length}):`);
        row.memberships.forEach((m) => {
          console.log(`      - userId=${m.userId} role=${m.role} status=${m.status} isDefault=${m.isDefault} joinedAt=${m.joinedAt}`);
        });
      } else {
        console.log('    memberships: (none)');
      }
      console.log('');
    });

    console.log('---\nDone.');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
};

fetchBusinesses();
