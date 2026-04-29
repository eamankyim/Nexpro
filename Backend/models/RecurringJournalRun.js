const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecurringJournalRun = sequelize.define(
  'RecurringJournalRun',
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
    recurringJournalId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'recurring_journals',
        key: 'id'
      }
    },
    runDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('success', 'failed', 'skipped'),
      allowNull: false,
      defaultValue: 'success'
    },
    journalEntryId: {
      type: DataTypes.UUID,
      references: {
        model: 'journal_entries',
        key: 'id'
      }
    },
    errorMessage: {
      type: DataTypes.TEXT
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'recurring_journal_runs',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenantId', 'recurringJournalId', 'runDate']
      }
    ]
  }
);

module.exports = RecurringJournalRun;
