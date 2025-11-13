const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubscriptionPlan = sequelize.define(
  'SubscriptionPlan',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    planId: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      comment: 'Unique identifier for the plan (e.g., trial, launch, scale)'
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Display order for sorting plans'
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Display name of the plan'
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Plan description'
    },
    price: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Price information: { amount, currency, display, billingPeriodLabel, billingDescription }'
    },
    highlights: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      comment: 'Array of key features/highlights'
    },
    marketing: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Marketing configuration: { enabled, perks, featureFlags, popular, priceDisplay, billing, badgeLabel, cta }'
    },
    onboarding: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      comment: 'Onboarding configuration: { enabled, subtitle, ctaLabel, badge, isDefault }'
    },
    seatLimit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum number of users/seats allowed (null = unlimited)'
    },
    seatPricePerAdditional: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Price per additional seat beyond base limit (null = cannot add seats)'
    },
    storageLimitMB: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Maximum storage in megabytes (null = unlimited)'
    },
    storagePrice100GB: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Price per additional 100GB of storage (null = cannot add storage)'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: 'Whether this plan is currently active and visible'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      comment: 'Additional metadata for future extensibility'
    }
  },
  {
    tableName: 'subscription_plans',
    timestamps: true,
    indexes: [
      {
        fields: ['planId'],
        unique: true
      },
      {
        fields: ['order']
      },
      {
        fields: ['isActive']
      }
    ]
  }
);

module.exports = SubscriptionPlan;

