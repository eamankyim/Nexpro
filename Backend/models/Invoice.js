const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Invoice = sequelize.define('Invoice', {
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
  invoiceNumber: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  invoiceDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Tax rate in percentage (e.g., 12.5 for 12.5%)'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discountType: {
    type: DataTypes.ENUM('percentage', 'fixed'),
    defaultValue: 'fixed'
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discountAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  discountReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason or description for the discount'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'),
    defaultValue: 'draft'
  },
  paymentTerms: {
    type: DataTypes.STRING,
    defaultValue: 'Due on Receipt',
    comment: 'e.g., "Net 30", "Due on Receipt", "Net 15"'
  },
  items: {
    type: DataTypes.JSON,
    defaultValue: [],
    comment: 'Line items from the job'
  },
  notes: {
    type: DataTypes.TEXT
  },
  termsAndConditions: {
    type: DataTypes.TEXT
  },
  sentDate: {
    type: DataTypes.DATE,
    comment: 'Date when invoice was sent to customer'
  },
  paidDate: {
    type: DataTypes.DATE,
    comment: 'Date when invoice was fully paid'
  }
}, {
  timestamps: true,
  tableName: 'invoices',
  hooks: {
    beforeSave: (invoice) => {
      // Calculate tax amount
      invoice.taxAmount = (parseFloat(invoice.subtotal) * parseFloat(invoice.taxRate || 0)) / 100;
      
      // Calculate discount amount
      if (invoice.discountType === 'percentage') {
        invoice.discountAmount = (parseFloat(invoice.subtotal) * parseFloat(invoice.discountValue || 0)) / 100;
      } else {
        invoice.discountAmount = parseFloat(invoice.discountValue || 0);
      }
      
      // Calculate total amount
      invoice.totalAmount = parseFloat(invoice.subtotal) + parseFloat(invoice.taxAmount) - parseFloat(invoice.discountAmount);
      
      // Calculate balance
      invoice.balance = parseFloat(invoice.totalAmount) - parseFloat(invoice.amountPaid || 0);
      
      // Update status based on payment
      if (invoice.balance <= 0 && invoice.amountPaid > 0) {
        invoice.status = 'paid';
        if (!invoice.paidDate) {
          invoice.paidDate = new Date();
        }
      } else if (invoice.amountPaid > 0 && invoice.balance > 0) {
        invoice.status = 'partial';
      } else if (invoice.dueDate && new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' && invoice.status !== 'cancelled') {
        invoice.status = 'overdue';
      }
    }
  }
});

module.exports = Invoice;







