const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserTask = sequelize.define('UserTask', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'todo',
    comment: 'todo | in_progress | on_hold | completed'
  },
  dueDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  priority: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'optional priority label (e.g. low, medium, high)'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assigneeId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE'
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  sourceType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  sourceId: {
    type: DataTypes.STRING(120),
    allowNull: true
  },
  sourceEvent: {
    type: DataTypes.STRING(80),
    allowNull: true
  },
  dedupeKey: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'user_tasks'
});

module.exports = UserTask;

