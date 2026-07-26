const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Services/products included in a tenant's Partner Program.
 * Optional per-item rate overrides; null = use program defaults.
 */
const PartnerProgramService = sequelize.define(
  'PartnerProgramService',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
    },
    partnerProgramSettingsId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'partner_program_settings', key: 'id' },
    },
    productId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'products', key: 'id' },
    },
    pricingTemplateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'pricing_templates', key: 'id' },
    },
    onlineServiceListingId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'online_service_listings', key: 'id' },
    },
    label: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    firstClientRatePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    returningClientRatePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'partner_program_services',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['partnerProgramSettingsId'] },
      { fields: ['productId'] },
      { fields: ['pricingTemplateId'] },
    ],
  }
);

module.exports = PartnerProgramService;
