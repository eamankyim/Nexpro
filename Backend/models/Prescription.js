const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Prescription = sequelize.define('Prescription', {
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
  pharmacyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'pharmacies',
      key: 'id'
    }
  },
  prescriptionNumber: {
    type: DataTypes.STRING,
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
  // Prescriber information
  prescriberName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  prescriberLicense: {
    type: DataTypes.STRING
  },
  prescriberPhone: {
    type: DataTypes.STRING
  },
  // Prescription details
  prescriptionDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expiryDate: {
    type: DataTypes.DATEONLY
  },
  status: {
    type: DataTypes.ENUM('pending', 'filled', 'partially_filled', 'cancelled', 'expired'),
    allowNull: false,
    defaultValue: 'pending'
  },
  // Totals
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  amountPaid: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Invoice reference (if invoice was generated)
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  filledBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  filledAt: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'prescriptions',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['pharmacyId']
    },
    {
      fields: ['customerId']
    },
    {
      fields: ['prescriptionNumber']
    },
    {
      fields: ['status']
    },
    {
      fields: ['prescriptionDate']
    }
  ]
});

module.exports = Prescription;
