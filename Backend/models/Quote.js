const crypto = require('crypto');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Quote = sequelize.define('Quote', {
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
  studioLocationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'studio_locations',
      key: 'id'
    }
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shops',
      key: 'id'
    }
  },
  quoteNumber: {
    type: DataTypes.STRING,
    allowNull: false
    // Unique per tenant via migration idx_quotes_tenant_quote_number
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
    type: DataTypes.ENUM('draft', 'sent', 'accepted', 'declined', 'expired'),
    defaultValue: 'draft'
  },
  validUntil: {
    type: DataTypes.DATE
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  discountTotal: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  discountReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'Reason or description for the discount'
  },
  totalAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  taxRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
    comment: 'Tax % applied to (subtotal - discountTotal)'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  notes: {
    type: DataTypes.TEXT
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  acceptedAt: {
    type: DataTypes.DATE
  },
  viewToken: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  attachments: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Typed files: proposal, requirements, agreement, other'
  },
  paymentSchedule: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
    comment: 'Milestone payments: [{ label, percent?, amount }]'
  },
  scopeOfWork: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Project scope text for studio quotations'
  },
  termsAndConditions: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Quotation terms; falls back to notes / org defaults when empty'
  },
  showClientAcceptance: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Show client acceptance signature block on project quotation PDF'
  }
}, {
  timestamps: true,
  tableName: 'quotes',
  hooks: {
    beforeCreate: (quote) => {
      if (!quote.viewToken) {
        quote.viewToken = crypto.randomBytes(32).toString('hex');
      }
    }
  }
});

module.exports = Quote;







