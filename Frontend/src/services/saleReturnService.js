import api from './api';
import { withActiveShopScope, buildScopedQueryString } from '../utils/shopScope';

const saleReturnService = {
  /**
   * Remaining returnable qty per sale line.
   * @param {string} saleId
   */
  getReturnable: async (saleId) => {
    return api.get(`/sales/${saleId}/returnable`);
  },

  /**
   * Create a refund or exchange for a sale (manager/admin).
   * @param {string} saleId
   * @param {object} payload
   */
  createReturn: async (saleId, payload) => {
    const res = await api.post(`/sales/${saleId}/returns`, payload);
    return res?.data ?? res;
  },

  /**
   * Paginated returns list for the tenant/shop.
   * @param {object} params
   */
  getReturns: async (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(withActiveShopScope(params)).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      searchParams.append(key, value);
    });
    const query = searchParams.toString();
    return api.get(query ? `/returns?${query}` : '/returns');
  },

  /**
   * Return detail by id.
   * @param {string} id
   */
  getReturnById: async (id) => {
    return api.get(`/returns/${id}`);
  },
};

export default saleReturnService;
