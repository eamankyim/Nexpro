const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DeliveryEvent = sequelize.define('DeliveryEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  channel: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'email | sms | whatsapp | api',
  },
  provider: {
    type: DataTypes.STRING(60),
    allowNull: true,
  },
  source: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'success | failed',
  },
  errorCode: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  recipientMasked: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  subjectOrContext: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'delivery_events',
});

module.exports = DeliveryEvent;
