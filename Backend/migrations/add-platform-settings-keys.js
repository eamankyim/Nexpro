const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../config/database');

const SEED_KEYS = [
  {
    key: 'platform:branding',
    value: {
      appName: 'NexPRO',
      primaryColor: '#2f80ed',
      secondaryColor: '#9b51e0',
      logoUrl: '',
      emailFooter: 'Thank you for using NexPRO.',
    },
  },
  {
    key: 'platform:featureFlags',
    value: {
      advancedAnalytics: false,
      autoBilling: false,
      publicSignup: true,
    },
  },
  {
    key: 'platform:communications',
    value: {
      supportEmail: 'support@nexpro.app',
      marketingEmail: 'marketing@nexpro.app',
      smsSender: '',
    },
  },
];

const seedPlatformSettings = async () => {
  console.log('🛠️  Seeding platform-setting rows...');
  try {
    for (const { key, value } of SEED_KEYS) {
      await sequelize.query(
        `
          INSERT INTO settings ("tenantId", key, value, "createdAt", "updatedAt")
          VALUES (NULL, :key, :value, NOW(), NOW())
          ON CONFLICT (key) DO NOTHING;
        `,
        {
          replacements: {
            key,
            value: JSON.stringify(value),
          },
        }
      );
    }

    console.log('✅ Platform settings seeded (where missing).');
  } catch (error) {
    console.error('💥 Failed to seed platform settings:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
};

seedPlatformSettings();


