const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformOpsRevealChallenge = sequelize.define('PlatformOpsRevealChallenge', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  codeHash: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  consumedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'platform_ops_reveal_challenges',
});

module.exports = PlatformOpsRevealChallenge;
