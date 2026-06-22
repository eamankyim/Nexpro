/**
 * Whether a sale was made through the dealer account channel.
 * @param {Object|null|undefined} sale
 * @returns {boolean}
 */
export function isDealerSale(sale) {
  if (!sale) return false;
  const channel = String(sale.saleChannel || '').toLowerCase();
  return channel === 'dealer' || !!sale.dealerId;
}

/**
 * Primary display name for the sale counterparty (dealer or customer).
 * @param {Object|null|undefined} sale
 * @returns {string}
 */
export function getSalePartyLabel(sale) {
  if (isDealerSale(sale)) {
    return sale?.dealer?.businessName || sale?.metadata?.dealerBusinessName || 'Dealer';
  }
  return sale?.customer?.name || sale?.customer?.company || 'Walk-in Customer';
}

/**
 * Bill-to / receipt party details for printable documents.
 * @param {Object|null|undefined} sale
 * @returns {{ type: 'dealer'|'customer'|'walk_in', title: string, name: string, company?: string, phone?: string, email?: string }}
 */
export function getSalePartyDetails(sale) {
  if (isDealerSale(sale)) {
    const dealer = sale?.dealer || {};
    return {
      type: 'dealer',
      title: 'Dealer',
      name: dealer.businessName || sale?.metadata?.dealerBusinessName || 'Dealer',
      company: dealer.contactName || undefined,
      phone: dealer.phone || undefined,
      email: dealer.email || undefined,
    };
  }

  if (sale?.customer) {
    return {
      type: 'customer',
      title: 'Customer',
      name: sale.customer.name || sale.customer.company || 'N/A',
      company: sale.customer.company || undefined,
      phone: sale.customer.phone || undefined,
      email: sale.customer.email || undefined,
    };
  }

  return {
    type: 'walk_in',
    title: 'Customer',
    name: 'Walk-in Customer',
  };
}
