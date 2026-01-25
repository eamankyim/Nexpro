const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DrugInteraction = sequelize.define('DrugInteraction', {
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
  drug1Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'drugs',
      key: 'id'
    }
  },
  drug2Id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'drugs',
      key: 'id'
    }
  },
  interactionType: {
    type: DataTypes.ENUM('major', 'moderate', 'minor', 'unknown'),
    allowNull: false,
    defaultValue: 'unknown'
  },
  severity: {
    type: DataTypes.ENUM('severe', 'moderate', 'mild', 'none'),
    allowNull: false,
    defaultValue: 'none'
  },
  description: {
    type: DataTypes.TEXT
  },
  clinicalSignificance: {
    type: DataTypes.TEXT
  },
  management: {
    type: DataTypes.TEXT
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'drug_interactions',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['drug1Id']
    },
    {
      fields: ['drug2Id']
    },
    {
      unique: true,
      fields: ['drug1Id', 'drug2Id']
    },
    {
      fields: ['interactionType']
    }
  ]
});

module.exports = DrugInteraction;
