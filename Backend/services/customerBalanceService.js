const { Customer, Invoice } = require('../models');
const { Op } = require('sequelize');

/**
 * Recalculate and update a customer's balance based on all their invoices
 * @param {string} customerId - The customer ID
 * @param {object} transaction - Optional Sequelize transaction
 * @returns {Promise<number>} The new balance
 */
const updateCustomerBalance = async (customerId, transaction = null) => {
  try {
    // Get all invoices for this customer
    const invoices = await Invoice.findAll({
      where: { customerId },
      attributes: ['balance', 'status'],
      transaction
    });

    // Calculate total outstanding balance from all invoices
    const totalBalance = invoices.reduce((sum, invoice) => {
      return sum + parseFloat(invoice.balance || 0);
    }, 0);

    // Update customer balance
    await Customer.update(
      { balance: totalBalance },
      { 
        where: { id: customerId },
        transaction
      }
    );

    console.log(`[CustomerBalance] Updated customer ${customerId} balance to GHS ${totalBalance.toFixed(2)}`);
    
    return totalBalance;
  } catch (error) {
    console.error('[CustomerBalance] Error updating customer balance:', error);
    throw error;
  }
};

/**
 * Update balances for multiple customers
 * @param {array} customerIds - Array of customer IDs
 * @param {object} transaction - Optional Sequelize transaction
 */
const updateMultipleCustomerBalances = async (customerIds, transaction = null) => {
  try {
    const uniqueCustomerIds = [...new Set(customerIds.filter(Boolean))];
    
    for (const customerId of uniqueCustomerIds) {
      await updateCustomerBalance(customerId, transaction);
    }
    
    console.log(`[CustomerBalance] Updated ${uniqueCustomerIds.length} customer balances`);
  } catch (error) {
    console.error('[CustomerBalance] Error updating multiple customer balances:', error);
    throw error;
  }
};

/**
 * Sync all customer balances in the system (for maintenance)
 * @param {string} tenantId - Optional tenant ID to limit sync to specific tenant
 */
const syncAllCustomerBalances = async (tenantId = null) => {
  try {
    console.log('[CustomerBalance] Starting full balance sync...');
    
    const where = tenantId ? { tenantId } : {};
    const customers = await Customer.findAll({
      where,
      attributes: ['id']
    });
    
    let updated = 0;
    for (const customer of customers) {
      await updateCustomerBalance(customer.id);
      updated++;
    }
    
    console.log(`[CustomerBalance] Synced ${updated} customer balances`);
    return updated;
  } catch (error) {
    console.error('[CustomerBalance] Error syncing all customer balances:', error);
    throw error;
  }
};

module.exports = {
  updateCustomerBalance,
  updateMultipleCustomerBalances,
  syncAllCustomerBalances
};



