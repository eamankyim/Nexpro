const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineStoreHeroDesign = sequelize.define('OnlineStoreHeroDesign', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'online_store_hero_categories',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING(160),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  thumbnailUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: 'online_store_hero_designs',
  timestamps: true,
  indexes: [
    { fields: ['categoryId'] },
    { fields: ['isActive', 'sortOrder'] },
  ],
});

module.exports = OnlineStoreHeroDesign;
