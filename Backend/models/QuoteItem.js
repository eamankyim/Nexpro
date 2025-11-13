const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuoteItem = sequelize.define('QuoteItem', {
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
  quoteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'quotes',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  discountPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Discount percentage applied to this line item'
  },
  discountReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason for line-item discount'
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'quote_items'
});

module.exports = QuoteItem;







