const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Shop = sequelize.define('Shop', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  code: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT
  },
  city: {
    type: DataTypes.STRING
  },
  state: {
    type: DataTypes.STRING
  },
  country: {
    type: DataTypes.STRING,
    defaultValue: 'Ghana'
  },
  postalCode: {
    type: DataTypes.STRING
  },
  phone: {
    type: DataTypes.STRING
  },
  email: {
    type: DataTypes.STRING,
    validate: {
      isEmail: true
    }
  },
  managerName: {
    type: DataTypes.STRING
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'shops',
  timestamps: true,
  hooks: {
    beforeCreate: (shop) => {
      if (shop.email && typeof shop.email === 'string') shop.email = shop.email.trim().toLowerCase();
      if (shop.phone && typeof shop.phone === 'string') {
        try {
          const { formatToE164 } = require('../utils/phoneUtils');
          const e164 = formatToE164(shop.phone.trim());
          if (e164) shop.phone = e164;
          else shop.phone = shop.phone.trim();
        } catch { shop.phone = shop.phone.trim(); }
      }
    },
    beforeUpdate: (shop) => {
      if (shop.changed('email') && shop.email && typeof shop.email === 'string') shop.email = shop.email.trim().toLowerCase();
      if (shop.changed('phone') && shop.phone && typeof shop.phone === 'string') {
        try {
          const { formatToE164 } = require('../utils/phoneUtils');
          const e164 = formatToE164(shop.phone.trim());
          if (e164) shop.phone = e164;
          else shop.phone = shop.phone.trim();
        } catch { shop.phone = shop.phone.trim(); }
      }
    }
  },
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      unique: true,
      fields: ['tenantId', 'code'],
      where: {
        code: { [require('sequelize').Op.ne]: null }
      }
    }
  ]
});

module.exports = Shop;
