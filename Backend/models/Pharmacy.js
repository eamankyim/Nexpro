const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pharmacy = sequelize.define('Pharmacy', {
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
    allowNull: true,
    validate: {
      isValidEmail(value) {
        if (value == null || String(value).trim() === '') return;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          throw new Error('Please provide a valid email address');
        }
      }
    }
  },
  pharmacistName: {
    type: DataTypes.STRING
  },
  licenseNumber: {
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
  tableName: 'pharmacies',
  timestamps: true,
  hooks: {
    beforeCreate: (pharmacy) => {
      if (pharmacy.email && typeof pharmacy.email === 'string') pharmacy.email = pharmacy.email.trim().toLowerCase();
      if (pharmacy.phone && typeof pharmacy.phone === 'string') {
        try {
          const { formatToE164 } = require('../utils/phoneUtils');
          const e164 = formatToE164(pharmacy.phone.trim());
          if (e164) pharmacy.phone = e164;
          else pharmacy.phone = pharmacy.phone.trim();
        } catch { pharmacy.phone = pharmacy.phone.trim(); }
      }
    },
    beforeUpdate: (pharmacy) => {
      if (pharmacy.changed('email') && pharmacy.email && typeof pharmacy.email === 'string') pharmacy.email = pharmacy.email.trim().toLowerCase();
      if (pharmacy.changed('phone') && pharmacy.phone && typeof pharmacy.phone === 'string') {
        try {
          const { formatToE164 } = require('../utils/phoneUtils');
          const e164 = formatToE164(pharmacy.phone.trim());
          if (e164) pharmacy.phone = e164;
          else pharmacy.phone = pharmacy.phone.trim();
        } catch { pharmacy.phone = pharmacy.phone.trim(); }
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

module.exports = Pharmacy;
