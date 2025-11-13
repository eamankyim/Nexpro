const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PayrollRun = sequelize.define(
  'PayrollRun',
  {
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
    periodStart: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    periodEnd: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    payDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('draft', 'processing', 'approved', 'paid', 'void'),
      defaultValue: 'draft'
    },
    totalGross: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    totalNet: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    totalTax: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    totalEmployees: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'payroll_runs',
    timestamps: true
  }
);

module.exports = PayrollRun;

