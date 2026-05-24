const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WhatsAppMessageEvent = sequelize.define('WhatsAppMessageEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'tenants', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  campaignId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'marketing_campaigns', key: 'id' },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  phoneNumberId: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  messageId: {
    type: DataTypes.STRING(160),
    allowNull: true
  },
  direction: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'outbound'
  },
  eventType: {
    type: DataTypes.STRING(40),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  recipientPhone: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  senderPhone: {
    type: DataTypes.STRING(40),
    allowNull: true
  },
  templateName: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'whatsapp_message_events',
  timestamps: true
});

module.exports = WhatsAppMessageEvent;
