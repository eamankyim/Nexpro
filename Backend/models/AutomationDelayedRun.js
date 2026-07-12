const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomationDelayedRun = sequelize.define('AutomationDelayedRun', {
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
  triggerContext: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  runAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'pending'
  },
  subjectKey: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'automation_delayed_runs',
  timestamps: true
});

module.exports = AutomationDelayedRun;
