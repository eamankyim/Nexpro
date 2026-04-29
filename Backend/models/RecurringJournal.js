const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecurringJournal = sequelize.define(
  'RecurringJournal',
  {
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
      type: DataTypes.STRING(200),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    templateType: {
      type: DataTypes.ENUM('recurring_journal', 'prepaid_expense'),
      allowNull: false,
      defaultValue: 'recurring_journal'
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed'),
      allowNull: false,
      defaultValue: 'active'
    },
    frequency: {
      type: DataTypes.ENUM('weekly', 'monthly', 'quarterly', 'yearly'),
      allowNull: false,
      defaultValue: 'monthly'
    },
    interval: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    amount: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0
    },
    debitAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    creditAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATEONLY
    },
    nextRunDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    lastRunDate: {
      type: DataTypes.DATEONLY
    },
    autoPost: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    createdBy: {
      type: DataTypes.UUID,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  },
  {
    tableName: 'recurring_journals',
    timestamps: true
  }
);

module.exports = RecurringJournal;
