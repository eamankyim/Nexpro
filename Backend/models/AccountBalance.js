const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AccountBalance = sequelize.define(
  'AccountBalance',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    fiscalYear: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    period: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    debit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    credit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    balance: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'account_balances',
    timestamps: true
  }
);

module.exports = AccountBalance;


