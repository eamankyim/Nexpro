const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PricingTemplate = sequelize.define('PricingTemplate', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jobType: {
    type: DataTypes.STRING
  },
  paperType: {
    type: DataTypes.STRING
  },
  paperSize: {
    type: DataTypes.STRING
  },
  materialType: {
    type: DataTypes.STRING
  },
  materialSize: {
    type: DataTypes.STRING
  },
  customHeight: {
    type: DataTypes.DECIMAL(10, 2)
  },
  customWidth: {
    type: DataTypes.DECIMAL(10, 2)
  },
  customUnit: {
    type: DataTypes.ENUM('feet', 'inches')
  },
  pricePerSquareFoot: {
    type: DataTypes.DECIMAL(10, 2)
  },
  // unit = quantity x unitPrice, square_foot = height x width x pricePerSquareFoot
  pricingMethod: {
    type: DataTypes.ENUM('unit', 'square_foot'),
    defaultValue: 'unit'
  },
  colorType: {
    type: DataTypes.ENUM('black_white', 'color', 'spot_color')
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  pricePerUnit: {
    type: DataTypes.DECIMAL(10, 2)
  },
  minimumQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  maximumQuantity: {
    type: DataTypes.INTEGER
  },
  setupFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discountTiers: {
    type: DataTypes.JSON
  },
  additionalOptions: {
    type: DataTypes.JSON
  },
  description: {
    type: DataTypes.TEXT
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  tableName: 'pricing_templates'
});

module.exports = PricingTemplate;


