module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invite_tokens', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      role: {
        type: Sequelize.ENUM('admin', 'manager', 'staff'),
        allowNull: false,
        defaultValue: 'staff'
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      usedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      usedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('invite_tokens', ['token'], { unique: true });
    await queryInterface.addIndex('invite_tokens', ['email']);
    await queryInterface.addIndex('invite_tokens', ['createdBy']);
    await queryInterface.addIndex('invite_tokens', ['used']);
    await queryInterface.addIndex('invite_tokens', ['expiresAt']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('invite_tokens');
  }
};

