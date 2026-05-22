/**
 * Composite indexes for tenant/shop-scoped list queries.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const addIndexSafe = async (table, fields, name) => {
      try {
        await queryInterface.addIndex(table, fields, { name, concurrently: false });
      } catch (err) {
        if (!/already exists/i.test(err?.message || '')) throw err;
      }
    };

    await addIndexSafe('products', ['tenantId', 'shopId', 'isActive'], 'products_tenant_shop_active_idx');
    await addIndexSafe('customers', ['tenantId', 'shopId', 'isActive'], 'customers_tenant_shop_active_idx');
    await addIndexSafe('sales', ['tenantId', 'shopId', 'status', 'createdAt'], 'sales_tenant_shop_status_created_idx');
  },

  async down(queryInterface) {
    const removeIndexSafe = async (table, name) => {
      try {
        await queryInterface.removeIndex(table, name);
      } catch (_) {
        /* ignore */
      }
    };
    await removeIndexSafe('products', 'products_tenant_shop_active_idx');
    await removeIndexSafe('customers', 'customers_tenant_shop_active_idx');
    await removeIndexSafe('sales', 'sales_tenant_shop_status_created_idx');
  },
};
