const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineStoreHeroColorway = sequelize.define('OnlineStoreHeroColorway', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  designId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'online_store_hero_designs',
      key: 'id',
    },
  },
  label: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },
  hexHint: {
    type: DataTypes.STRING(24),
    allowNull: true,
    comment: 'Representative color for brand matching, e.g. #0369a1',
  },
  imageUrl: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'online_store_hero_colorways',
  timestamps: true,
  indexes: [
    { fields: ['designId'] },
    { fields: ['isActive', 'sortOrder'] },
  ],
});

module.exports = OnlineStoreHeroColorway;
