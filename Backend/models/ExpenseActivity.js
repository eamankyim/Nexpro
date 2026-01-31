const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExpenseActivity = sequelize.define('ExpenseActivity', {
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
  expenseId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'expenses',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('note', 'status_change', 'payment', 'approval', 'rejection', 'submission', 'update', 'creation'),
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
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'expense_activities',
  timestamps: true
});

module.exports = ExpenseActivity;
