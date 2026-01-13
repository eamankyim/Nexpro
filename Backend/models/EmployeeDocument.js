const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmployeeDocument = sequelize.define(
  'EmployeeDocument',
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
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    type: {
      type: DataTypes.STRING
    },
    title: {
      type: DataTypes.STRING
    },
    fileUrl: {
      type: DataTypes.TEXT, // TEXT for base64 file data or file path
      allowNull: false
    },
    uploadedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'employee_documents',
    timestamps: true
  }
);

module.exports = EmployeeDocument;



