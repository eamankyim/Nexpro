const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemHealthIssue = sequelize.define('SystemHealthIssue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  fingerprint: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  severity: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'warning',
    comment: 'critical | warning | info',
  },
  category: {
    type: DataTypes.STRING(40),
    allowNull: false,
    comment: 'sms | email | api | config | infra',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'open',
    comment: 'open | acknowledged | resolved',
  },
  firstSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  occurrenceCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  lastErrorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notifiedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  acknowledgedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'system_health_issues',
});

module.exports = SystemHealthIssue;
