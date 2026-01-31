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
  },

  // Get product sales report (for shop/pharmacy)
  getProductSalesReport: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/product-sales?${queryString}` : '/reports/product-sales';
    return await api.get(url);
  },

  // Get inventory summary
  getInventorySummary: async () => {
    return await api.get('/reports/inventory-summary');
  },

  // Get inventory movements
  getInventoryMovements: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/inventory-movements?${queryString}` : '/reports/inventory-movements';
    return await api.get(url);
  },

  // Get fastest moving items
  getFastestMovingItems: async (startDate = null, endDate = null, limit = 5) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', limit);
    
    const queryString = params.toString();
    const url = `/reports/fastest-moving-items?${queryString}`;
    return await api.get(url);
  },

  // Get revenue by channel
  getRevenueByChannel: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/revenue-by-channel?${queryString}` : '/reports/revenue-by-channel';
    return await api.get(url);
  },

  // Generate AI-powered report analysis
  generateAIAnalysis: async (reportData, options = {}) => {
    return await api.post('/reports/ai-analysis', {
      reportData,
      options
    });
  },

  // Get KPI summary
  getKpiSummary: async (startDate = null, endDate = null) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    const url = queryString ? `/reports/kpi-summary?${queryString}` : '/reports/kpi-summary';
    return await api.get(url);
  },

  // Get top customers
  getTopCustomers: async (startDate = null, endDate = null, limit = 5) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    params.append('limit', limit);
    
    const queryString = params.toString();
    const url = `/reports/top-customers?${queryString}`;
    return await api.get(url);
  },

  // Get pipeline summary
  getPipelineSummary: async () => {
    return await api.get('/reports/pipeline-summary');
  }
};

export default reportService;

