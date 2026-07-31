const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformOpsSecretReveal = sequelize.define('PlatformOpsSecretReveal', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  assetId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'platform_ops_assets', key: 'id' },
  },
  requestedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  method: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'password | email_otp',
  },
  success: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: 'platform_ops_secret_reveals',
});

module.exports = PlatformOpsSecretReveal;
