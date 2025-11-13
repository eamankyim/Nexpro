const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JobStatusHistory = sequelize.define('JobStatusHistory', {
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
    }
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'jobs',
      key: 'id'
    },
    onDelete: 'CASCADE'
  },
  status: {
    type: DataTypes.ENUM('new', 'in_progress', 'on_hold', 'cancelled', 'completed'),
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT
  },
  changedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'job_status_history',
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: false
});

module.exports = JobStatusHistory;


