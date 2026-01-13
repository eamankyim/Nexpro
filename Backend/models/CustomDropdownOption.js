const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomDropdownOption = sequelize.define('CustomDropdownOption', {
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
  dropdownType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Type of dropdown: job_category, customer_source, employee_relationship, employee_bank, lead_source, region, etc.'
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'The custom option value entered by user'
  },
  label: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Optional display label (defaults to value)'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'custom_dropdown_options',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['tenantId', 'dropdownType', 'value'],
      name: 'unique_tenant_dropdown_value'
    },
    {
      fields: ['tenantId', 'dropdownType', 'isActive']
    }
  ]
});

module.exports = CustomDropdownOption;



