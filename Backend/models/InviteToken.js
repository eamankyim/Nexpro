const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InviteToken = sequelize.define('InviteToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [32, 32] // 32 character token
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'staff'),
    defaultValue: 'staff',
    allowNull: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  used: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  usedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  usedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Optional name to pre-fill in signup form'
  }
}, {
  timestamps: true,
  tableName: 'invite_tokens'
});

module.exports = InviteToken;

