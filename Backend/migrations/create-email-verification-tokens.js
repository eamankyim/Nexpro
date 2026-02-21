module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'email_verification_tokens';
    const tables = await queryInterface.showAllTables();
    if (tables.includes(tableName)) {
      return;
    }
    await queryInterface.createTable(tableName, {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      token: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex(tableName, ['token'], { unique: true });
    await queryInterface.addIndex(tableName, ['userId']);
    await queryInterface.addIndex(tableName, ['expiresAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('email_verification_tokens');
  }
};
