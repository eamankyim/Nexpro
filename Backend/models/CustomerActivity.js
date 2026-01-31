const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomerActivity = sequelize.define('CustomerActivity', {
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
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('call', 'email', 'meeting', 'note', 'task'),
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
  tableName: 'customer_activities',
  timestamps: true
});

module.exports = CustomerActivity;
