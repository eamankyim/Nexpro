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
    validate: {
      isEmail: true
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
