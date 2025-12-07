import api from './api';

const reportService = {
  // Get revenue report
  getRevenueReport: async (startDate = null, endDate = null, groupBy = 'day') => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (groupBy) params.append('groupBy', groupBy);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/revenue?${queryString}` : '/reports/revenue';
    return await api.get(url);
  },

  // Get expense report
  getExpenseReport: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/expenses?${queryString}` : '/reports/expenses';
    return await api.get(url);
  },

  // Get outstanding payments report
  getOutstandingPaymentsReport: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/outstanding-payments?${queryString}` : '/reports/outstanding-payments';
    return await api.get(url);
  },

  // Get sales report
  getSalesReport: async (startDate = null, endDate = null, groupBy = 'jobType') => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (groupBy) params.append('groupBy', groupBy);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/sales?${queryString}` : '/reports/sales';
    return await api.get(url);
  },

  // Get profit & loss report
  getProfitLossReport: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/profit-loss?${queryString}` : '/reports/profit-loss';
    return await api.get(url);
  },

  // Get service analytics report
  getServiceAnalyticsReport: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/service-analytics?${queryString}` : '/reports/service-analytics';
    return await api.get(url);
  }
};

export default reportService;

