const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Job = sequelize.define('Job', {
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
  jobNumber: {
    type: DataTypes.STRING,
    allowNull: false
    // Unique constraint is now composite (tenantId, jobNumber) at database level
    // This allows same job number across different tenants
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
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  timestamps: true,
  tableName: 'jobs',
  indexes: [
    {
      unique: true,
      fields: ['tenantId', 'jobNumber'],
      name: 'jobs_tenantId_jobNumber_key'
    }
  ]
});

module.exports = Job;


