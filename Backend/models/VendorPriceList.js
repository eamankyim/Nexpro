const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorPriceList = sequelize.define('VendorPriceList', {
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
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'vendors',
      key: 'id'
    }
  },
  itemType: {
    type: DataTypes.ENUM('service', 'product'),
    allowNull: false,
    defaultValue: 'service'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'unit'
  },
  imageUrl: {
    type: DataTypes.TEXT // TEXT for base64 image data
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'vendor_price_lists'
});

module.exports = VendorPriceList;


