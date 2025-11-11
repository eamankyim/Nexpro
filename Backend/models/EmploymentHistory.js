const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EmploymentHistory = sequelize.define(
  'EmploymentHistory',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    employeeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'employees',
        key: 'id'
      }
    },
    changeType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    fromValue: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    toValue: {
      type: DataTypes.JSONB,
      defaultValue: {}
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
    tableName: 'employment_histories',
    timestamps: true
  }
);

module.exports = EmploymentHistory;



