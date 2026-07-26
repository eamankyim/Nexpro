const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineStoreHeroCategory = sequelize.define('OnlineStoreHeroCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  slug: {
    type: DataTypes.STRING(80),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(120),
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
  tableName: 'online_store_hero_categories',
  timestamps: true,
  indexes: [
    { fields: ['isActive', 'sortOrder'] },
  ],
});

module.exports = OnlineStoreHeroCategory;
