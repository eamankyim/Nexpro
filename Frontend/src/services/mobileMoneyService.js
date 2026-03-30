import api from './api';

/**
 * Mobile Money Service
 * Handles MTN Mobile Money and Airtel Money payment API calls
 */
const mobileMoneyService = {
  /**
   * Initiate a mobile money payment
   * @param {Object} payload - Payment data
   * @param {string} payload.saleId - Sale ID (optional)
   * @param {string} payload.invoiceId - Invoice ID (optional)
   * @param {string} payload.phoneNumber - Customer phone (format: 233XXXXXXXXX)
   * @param {number} payload.amount - Amount to charge
   * @param {string} payload.currency - Currency code (default: GHS)
   * @param {string} payload.provider - Provider (MTN or AIRTEL, auto-detected if not provided)
   * @param {string} payload.payerMessage - Message to show customer
   * @returns {Promise} API response with referenceId and status
   */
  initiatePayment: async (payload) => {
    return api.post('/mobile-money/pay', payload);
  },

  /**
   * Check payment status
   * @param {string} referenceId - Payment reference ID
   * @param {string} provider - Provider (MTN or AIRTEL)
   * @returns {Promise} API response with payment status
   */
  checkPaymentStatus: async (referenceId, provider) => {
    return api.get(`/mobile-money/status/${referenceId}?provider=${provider}`);
  },

  /**
   * Poll sale payment status (updates sale if successful)
   * @param {string} saleId - Sale ID
   * @returns {Promise} API response with updated status
   */
  pollSalePayment: async (saleId) => {
    return api.post(`/mobile-money/poll/${saleId}`);
  },

  /**
   * Validate phone number for mobile money
   * @param {string} phoneNumber - Phone number to validate
   * @param {string} provider - Optional provider to check against
   * @returns {Promise} API response with validation result
   */
  validatePhoneNumber: async (phoneNumber, provider = null) => {
    const params = provider ? `?provider=${provider}` : '';
    return api.get(`/mobile-money/validate/${phoneNumber}${params}`);
  },

  /**
   * Detect mobile money provider from phone number
   * @param {string} phoneNumber - Phone number
   * @returns {Promise} API response with detected provider
   */
  detectProvider: async (phoneNumber) => {
    return api.get(`/mobile-money/detect-provider/${phoneNumber}`);
  },

  /**
   * Client-side provider detection (no API call)
   * @param {string} phoneNumber - Phone number
   * @returns {string} Provider name (MTN, AIRTEL, UNKNOWN)
   */
  detectProviderLocal: (phoneNumber) => {
    const cleaned = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');
    
    // Ghana prefixes
    if (cleaned.startsWith('233')) {
      const prefix = cleaned.substring(3, 5);
      if (['24', '54', '55', '59'].includes(prefix)) return 'MTN';
      if (['26', '27', '57'].includes(prefix)) return 'AIRTEL';
      if (['20', '50'].includes(prefix)) return 'VODAFONE';
    }
    
    // Uganda prefixes
    if (cleaned.startsWith('256')) {
      const prefix = cleaned.substring(3, 5);
      if (['77', '78', '76'].includes(prefix)) return 'MTN';
      if (['70', '75'].includes(prefix)) return 'AIRTEL';
    }
    
    // Kenya prefixes
    if (cleaned.startsWith('254')) {
      const prefix = cleaned.substring(3, 5);
      if (['73', '78'].includes(prefix)) return 'AIRTEL';
    }
    
    return 'UNKNOWN';
  },

  /**
   * Format phone number for display
   * @param {string} phoneNumber - Phone number
   * @param {string} countryCode - Country code (default: 233)
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber: (phoneNumber, countryCode = '233') => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    if (cleaned.startsWith(countryCode)) {
      return `+${cleaned}`;
    }
    
    if (cleaned.startsWith('0')) {
      return `+${countryCode}${cleaned.substring(1)}`;
    }
    
    return `+${countryCode}${cleaned}`;
  },

  /**
   * Get provider display info
   * @param {string} provider - Provider code
   * @returns {Object} Provider display info
   */
  getProviderInfo: (provider) => {
    const providers = {
      MTN: {
        name: 'MTN Mobile Money',
        shortName: 'MTN MoMo',
        color: '#FFCC00',
        textColor: '#000000',
        logo: '/images/mtn-logo.png'
      },
      AIRTEL: {
        name: 'Airtel Money',
        shortName: 'Airtel Money',
        color: '#E40000',
        textColor: '#FFFFFF',
        logo: '/images/airtel-logo.png'
      }
    };
    
    return providers[provider] || {
      name: 'Mobile Money',
      shortName: 'Mobile Money',
      color: '#666666',
      textColor: '#FFFFFF',
      logo: null
    };
  }
};

export default mobileMoneyService;
