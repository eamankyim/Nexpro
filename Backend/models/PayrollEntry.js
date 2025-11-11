const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PayrollEntry = sequelize.define(
  'PayrollEntry',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    payrollRunId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'payroll_runs',
        key: 'id'
      }
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    grossPay: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    netPay: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    allowances: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    deductions: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    taxes: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'payroll_entries',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['payrollRunId', 'employeeId']
      }
    ]
  }
);

module.exports = PayrollEntry;


