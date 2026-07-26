const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

/**
 * Sabito App marketer identity (separate from ABS workspace users).
 */
const Marketer = sequelize.define(
  'Marketer',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    momoNumber: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: 'Display-only payout destination for businesses',
    },
    bankDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'marketers',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['email'] },
      { fields: ['phone'] },
      { fields: ['isActive'] },
    ],
    hooks: {
      beforeValidate: (marketer) => {
        if (marketer.email && typeof marketer.email === 'string') {
          marketer.email = marketer.email.trim().toLowerCase();
        }
        if (marketer.phone && typeof marketer.phone === 'string') {
          marketer.phone = marketer.phone.trim();
        }
      },
      beforeCreate: async (marketer) => {
        if (marketer.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
          const salt = await bcrypt.genSalt(rounds);
          marketer.password = await bcrypt.hash(marketer.password, salt);
        }
      },
      beforeUpdate: async (marketer) => {
        if (marketer.changed('password') && marketer.password) {
          const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
          const salt = await bcrypt.genSalt(rounds);
          marketer.password = await bcrypt.hash(marketer.password, salt);
        }
      },
    },
  }
);

Marketer.prototype.comparePassword = async function comparePassword(candidate) {
  return bcrypt.compare(String(candidate || ''), this.password);
};

module.exports = Marketer;
