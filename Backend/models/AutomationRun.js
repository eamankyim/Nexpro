const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomationRun = sequelize.define('AutomationRun', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  ruleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'automation_rules', key: 'id' },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'success'
  },
  triggerContext: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  resultSummary: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  finishedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'automation_runs',
  timestamps: true
});

module.exports = AutomationRun;
