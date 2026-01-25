const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Barcode = sequelize.define('Barcode', {
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
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  productVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id'
    }
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  barcodeType: {
    type: DataTypes.ENUM('EAN13', 'EAN8', 'UPC', 'CODE128', 'CODE39', 'QR', 'other'),
    allowNull: false,
    defaultValue: 'EAN13'
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
  tableName: 'barcodes',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['barcode']
    },
    {
      fields: ['tenantId']
    },
    {
      fields: ['productId']
    },
    {
      fields: ['productVariantId']
    }
  ]
});

module.exports = Barcode;
