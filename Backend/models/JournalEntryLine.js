const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JournalEntryLine = sequelize.define(
  'JournalEntryLine',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    journalEntryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'journal_entries',
        key: 'id'
      }
    },
    accountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    debit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    credit: {
      type: DataTypes.DECIMAL(14, 2),
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'journal_entry_lines',
    timestamps: true
  }
);

module.exports = JournalEntryLine;


