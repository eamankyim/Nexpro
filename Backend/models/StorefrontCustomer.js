const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const StorefrontCustomer = sequelize.define('StorefrontCustomer', {
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
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  googleId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
    field: 'google_id',
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  emailVerifiedAt: {
    type: DataTypes.DATE,
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
}, {
  tableName: 'storefront_customers',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['google_id'] },
    { fields: ['phone'] },
    { fields: ['isActive'] },
  ],
  hooks: {
    beforeValidate: (customer) => {
      if (customer.email && typeof customer.email === 'string') {
        customer.email = customer.email.trim().toLowerCase();
      }
      if (customer.phone && typeof customer.phone === 'string') {
        customer.phone = customer.phone.trim();
      }
    },
    beforeCreate: async (customer) => {
      if (customer.password) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
        const salt = await bcrypt.genSalt(rounds);
        customer.password = await bcrypt.hash(customer.password, salt);
      }
    },
    beforeUpdate: async (customer) => {
      if (customer.changed('password') && customer.password) {
        const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
        const salt = await bcrypt.genSalt(rounds);
        customer.password = await bcrypt.hash(customer.password, salt);
      }
    },
  },
});

StorefrontCustomer.prototype.comparePassword = async function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

StorefrontCustomer.prototype.toJSON = function toJSON() {
  const values = { ...this.get() };
  delete values.password;
  if (values.metadata?.emailVerification || values.metadata?.loginOtp || values.metadata?.passwordReset) {
    values.metadata = { ...values.metadata };
    delete values.metadata.emailVerification;
    delete values.metadata.loginOtp;
    delete values.metadata.passwordReset;
  }
  return values;
};

module.exports = StorefrontCustomer;
