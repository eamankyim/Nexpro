const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
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
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'info'
  },
  priority: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'normal'
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  channels: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: ['in_app']
  },
  icon: {
    type: DataTypes.STRING
  },
  link: {
    type: DataTypes.STRING
  },
  triggeredBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  readAt: {
    type: DataTypes.DATE
  },
  expiresAt: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true,
  tableName: 'notifications'
});

module.exports = Notification;



