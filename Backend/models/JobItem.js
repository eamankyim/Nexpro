const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JobItem = sequelize.define('JobItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  paperSize: {
    type: DataTypes.STRING
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  unitPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  specifications: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  timestamps: true,
  tableName: 'job_items'
});

module.exports = JobItem;




