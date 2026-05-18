const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomerFeedback = sequelize.define(
  'CustomerFeedback',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' }
    },
    rating: {
      type: DataTypes.SMALLINT,
      allowNull: false,
      validate: { min: 1, max: 5 }
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contactName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    contactEmail: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    contactPhone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'direct'
    },
    sourceRef: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  },
  {
    tableName: 'customer_feedback',
    timestamps: true
  }
);

module.exports = CustomerFeedback;
