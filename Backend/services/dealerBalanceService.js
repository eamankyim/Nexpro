const { Dealer } = require('../models');

const roundMoney = (value) => Math.round(parseFloat(value || 0) * 100) / 100;

const parseAmount = (value) => {
  const parsed = parseFloat(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Amount must be a non-negative number');
  }
  return roundMoney(parsed);
};

/**
 * Compute balance after applying a ledger direction.
 * Debit increases what the dealer owes; credit reduces it.
 * @param {number} currentBalance
 * @param {'debit'|'credit'} direction
 * @param {number} amount
 * @returns {number}
 */
const computeBalanceAfter = (currentBalance, direction, amount) => {
  const current = roundMoney(currentBalance);
  const delta = parseAmount(amount);
  if (direction === 'debit') {
    return roundMoney(current + delta);
  }
  if (direction === 'credit') {
    return roundMoney(current - delta);
  }
  throw new Error(`Invalid ledger direction: ${direction}`);
};

/**
 * Available credit = creditLimit - balance (balance is amount owed).
 * @param {{ balance?: number|string, creditLimit?: number|string }} dealer
 * @returns {number}
 */
const getAvailableCredit = (dealer) => {
  const balance = roundMoney(dealer?.balance || 0);
  const creditLimit = roundMoney(dealer?.creditLimit || 0);
  return roundMoney(Math.max(creditLimit - balance, 0));
};

/**
 * Check whether a charge would exceed credit limit.
 * @param {{ balance?: number|string, creditLimit?: number|string }} dealer
 * @param {number} chargeAmount
 * @param {boolean} [creditOverride=false]
 * @returns {{ allowed: boolean, projectedBalance: number, availableCredit: number, exceedsLimit: boolean }}
 */
const checkCreditLimit = (dealer, chargeAmount, creditOverride = false) => {
  const balance = roundMoney(dealer?.balance || 0);
  const creditLimit = roundMoney(dealer?.creditLimit || 0);
  const charge = parseAmount(chargeAmount);
  const projectedBalance = roundMoney(balance + charge);
  const availableCredit = roundMoney(Math.max(creditLimit - balance, 0));
  const exceedsLimit = creditLimit > 0 && projectedBalance > creditLimit + 0.001;
  return {
    allowed: !exceedsLimit || creditOverride === true,
    projectedBalance,
    availableCredit,
    exceedsLimit,
  };
};

/**
 * Lock dealer row and apply a ledger movement, updating cached balance.
 * @param {object} params
 * @param {string} params.dealerId
 * @param {'debit'|'credit'} params.direction
 * @param {number|string} params.amount
 * @param {import('sequelize').Transaction} [params.transaction]
 * @returns {Promise<{ previousBalance: number, balanceAfter: number }>}
 */
const applyBalanceChange = async ({ dealerId, direction, amount, transaction = null }) => {
  const dealer = await Dealer.findByPk(dealerId, {
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!dealer) {
    throw new Error('Dealer not found');
  }

  const previousBalance = roundMoney(dealer.balance);
  const balanceAfter = computeBalanceAfter(previousBalance, direction, amount);

  await dealer.update({ balance: balanceAfter }, { transaction });

  return { previousBalance, balanceAfter };
};

module.exports = {
  roundMoney,
  parseAmount,
  computeBalanceAfter,
  getAvailableCredit,
  checkCreditLimit,
  applyBalanceChange,
};
