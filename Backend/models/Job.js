const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  jobNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  status: {
    type: DataTypes.ENUM('new', 'in_progress', 'on_hold', 'cancelled', 'completed'),
    defaultValue: 'new'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  jobType: {
    type: DataTypes.STRING
  },
  quoteId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'quotes',
      key: 'id'
    }
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  paperType: {
    type: DataTypes.STRING
  },
  paperSize: {
    type: DataTypes.STRING
  },
  colorType: {
    type: DataTypes.ENUM('black_white', 'color', 'spot_color'),
    defaultValue: 'black_white'
  },
  finishingOptions: {
    type: DataTypes.JSON
  },
  estimatedCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  actualCost: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  quotedPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  finalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  orderDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  startDate: {
    type: DataTypes.DATE
  },
  dueDate: {
    type: DataTypes.DATE
  },
  completionDate: {
    type: DataTypes.DATE
  },
  assignedTo: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT
  },
  attachments: {
    type: DataTypes.JSON
  }
}, {
  timestamps: true,
  tableName: 'jobs'
});

module.exports = Job;


