const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserWeekFocus = sequelize.define('UserWeekFocus', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  weekStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Monday of the week (YYYY-MM-DD)'
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Array of { text: string, order: number }'
  }
}, {
  timestamps: true,
  tableName: 'user_week_focus'
});

module.exports = UserWeekFocus;
