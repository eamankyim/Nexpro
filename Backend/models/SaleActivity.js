const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleActivity = sequelize.define('SaleActivity', {
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
  saleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('note', 'status_change', 'payment', 'refund'),
    defaultValue: 'note'
  },
  subject: {
    type: DataTypes.STRING
  },
  notes: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  nextStep: {
    type: DataTypes.STRING
  },
  followUpDate: {
    type: DataTypes.DATE
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'sale_activities',
  timestamps: true
});

module.exports = SaleActivity;
