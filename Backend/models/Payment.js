const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  paymentNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('income', 'expense'),
    allowNull: false
  },
  customerId: {
    type: DataTypes.UUID,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  vendorId: {
    type: DataTypes.UUID,
    references: {
      model: 'vendors',
      key: 'id'
    }
  },
  jobId: {
    type: DataTypes.UUID,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'check', 'credit_card', 'bank_transfer', 'other'),
    defaultValue: 'cash'
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  referenceNumber: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'refunded'),
    defaultValue: 'completed'
  },
  notes: {
    type: DataTypes.TEXT
  }
}, {
  timestamps: true,
  tableName: 'payments'
});

module.exports = Payment;


