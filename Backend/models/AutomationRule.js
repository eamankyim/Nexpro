const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutomationRule = sequelize.define('AutomationRule', {
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
  name: {
    type: DataTypes.STRING(160),
    allowNull: false
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  triggerType: {
    type: DataTypes.STRING(80),
    allowNull: false
  },
  // Branch scope: null = applies to all branches (shop/pharmacy workspaces use shopId,
  // studio-like workspaces use studioLocationId; at most one is set per tenant business type).
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'shops', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  studioLocationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'studio_locations', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  triggerConfig: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  conditionConfig: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  actionConfig: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  scheduleConfig: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'automation_rules',
  timestamps: true
});

module.exports = AutomationRule;
