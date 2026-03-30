import api from './api';

const saleService = {
  // Get all sales
  getSales: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/sales?${query}` : '/sales');
  },

  // Get sale by ID
  getSaleById: async (id) => {
    return api.get(`/sales/${id}`);
  },

  /**
   * Check Paystack charge status for a pending MoMo sale; backend will update sale if charge succeeded.
   * Use when polling for MoMo completion (works when webhook cannot reach server, e.g. local dev).
   * @param {string} saleId - Sale ID
   * @returns {Promise<{ success: boolean, data: object }>} Same shape as getSaleById
   */
  checkPaystackCharge: async (saleId) => {
    return api.get(`/sales/${saleId}/check-paystack-charge`);
  },

  // Create a new sale
  createSale: async (payload) => {
    return api.post('/sales', payload);
  },

  /**
   * Batch sync offline sales (idempotent by clientId)
   * @param {Array<{ clientId: string, payload: object }>} items
   * @returns {Promise<{ results: Array<{ clientId, id?, error? }> }>}
   */
  syncBatch: async (items) => {
    const res = await api.post('/sales/sync', { items });
    return res?.data ?? res;
  },

  // Update a sale
  updateSale: async (id, payload) => {
    return api.put(`/sales/${id}`, payload);
  },

  /**
   * Record payment on a sale (partial or full).
   * @param {string} saleId - Sale ID
   * @param {{ amount: number, paymentMethod: string, referenceNumber?: string, paymentDate?: string }} payload
   */
  recordPayment: async (saleId, payload) => {
    const body = {
      amount: payload.amount,
      paymentMethod: payload.paymentMethod || 'cash',
    };
    if (payload.referenceNumber != null && payload.referenceNumber !== '') body.referenceNumber = payload.referenceNumber;
    if (payload.paymentDate) {
      body.paymentDate = typeof payload.paymentDate === 'string'
        ? payload.paymentDate
        : new Date(payload.paymentDate).toISOString().slice(0, 10);
    }
    const res = await api.post(`/sales/${saleId}/payment`, body);
    return res?.data ?? res;
  },

  /**
   * Update order status (restaurant kitchen only)
   * @param {string} saleId - Sale ID
   * @param {string} orderStatus - One of: received, preparing, ready, completed
   */
  updateOrderStatus: async (saleId, orderStatus) => {
    const res = await api.patch(`/sales/${saleId}/order-status`, { orderStatus });
    return res?.data ?? res;
  },

  /**
   * First-party delivery status (all shop types). Pass null to clear.
   * @param {string} saleId
   * @param {string|null} deliveryStatus
   */
  updateDeliveryStatus: async (saleId, deliveryStatus) => {
    const res = await api.patch(`/sales/${saleId}/delivery-status`, { deliveryStatus });
    return res?.data ?? res;
  },

  /**
   * Get orders for kitchen dashboard (supports orderStatus and activeOrders filters)
   * @param {Object} filters - { orderStatus, activeOrders, startDate, endDate, page, limit }
   */
  getOrders: async (filters = {}) => {
    const params = { ...filters };
    if (params.activeOrders) params.activeOrders = 'true';
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/sales?${query}` : '/sales');
  },

  // Delete a sale
  deleteSale: async (id) => {
    return api.delete(`/sales/${id}`);
  },

  // Get sales statistics
  getSalesStats: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    return api.get(query ? `/sales/stats?${query}` : '/sales/stats');
  },

  // Get top selling products
  getTopProducts: async (limit = 10, startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    params.append('limit', limit);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return api.get(`/sales/top-products?${params.toString()}`);
  },

  // Get sale activities
  getActivities: async (saleId) => {
    return api.get(`/sales/${saleId}/activities`);
  },

  // Add sale activity
  addActivity: async (saleId, activityData) => {
    return api.post(`/sales/${saleId}/activities`, activityData);
  },

  // Send receipt via SMS/WhatsApp/Email
  sendReceipt: async (saleId, { channels, phone, email }) => {
    return api.post(`/sales/${saleId}/send-receipt`, { channels, phone, email });
  },

  /**
   * Initialize Paystack payment for a pending sale (POS MoMo/card)
   * @param {string} saleId - Sale ID
   * @param {{ email?: string, callbackUrl?: string }} params
   * @returns {Promise<{ authorizationUrl, reference, accessCode }>}
   */
  initializePaystackPayment: async (saleId, { email, callbackUrl } = {}) => {
    const res = await api.post(`/sales/${saleId}/initialize-paystack`, { email, callbackUrl });
    return res?.data ?? res;
  },

  /**
   * Initiate Paystack Mobile Money payment for a pending sale (POS)
   * @param {string} saleId - Sale ID
   * @param {{ phoneNumber: string, provider: string }} payload
   * @returns {Promise<any>} API response with reference and status
   */
  paystackMobileMoneyPay: async (saleId, { phoneNumber, provider }) => {
    const res = await api.post(`/sales/${saleId}/paystack-mobile-money`, { phoneNumber, provider });
    // Return full response so caller can check success; api interceptor already returns response.data
    console.log('[MoMo] paystackMobileMoneyPay response:', { saleId, rawResponse: res, hasSuccess: !!res?.success, successValue: res?.success });
    return res;
  }
};

export default saleService;
