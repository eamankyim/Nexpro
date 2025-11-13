const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Employee = sequelize.define(
  'Employee',
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
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    middleName: {
      type: DataTypes.STRING
    },
    preferredName: {
      type: DataTypes.STRING
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING
    },
    jobTitle: {
      type: DataTypes.STRING
    },
    department: {
      type: DataTypes.STRING
    },
    employmentType: {
      type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'intern', 'temporary', 'national_service'),
      defaultValue: 'full_time'
    },
    status: {
      type: DataTypes.ENUM('active', 'on_leave', 'terminated', 'probation'),
      defaultValue: 'active'
    },
    hireDate: {
      type: DataTypes.DATEONLY
    },
    endDate: {
      type: DataTypes.DATEONLY
    },
    salaryType: {
      type: DataTypes.ENUM('salary', 'hourly', 'commission'),
      defaultValue: 'salary'
    },
    salaryAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    payFrequency: {
      type: DataTypes.ENUM('monthly', 'biweekly', 'weekly', 'daily'),
      defaultValue: 'monthly'
    },
    bankName: {
      type: DataTypes.STRING
    },
    bankAccountName: {
      type: DataTypes.STRING
    },
    bankAccountNumber: {
      type: DataTypes.STRING
    },
    emergencyContact: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    nextOfKin: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    address: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    notes: {
      type: DataTypes.TEXT
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  },
  {
    tableName: 'employees',
    timestamps: true
  }
);

module.exports = Employee;

