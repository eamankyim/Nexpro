const axios = require('axios');
const { Customer, SabitoTenantMapping, Tenant } = require('../models');

/**
 * Service to sync customers from Sabito to NEXPro
 */
class SabitoSyncService {
  constructor() {
    this.baseUrl = process.env.SABITO_API_URL || 'http://localhost:4002';
    this.apiKey = process.env.SABITO_API_KEY;
  }

  /**
   * Fetch customers from Sabito API for a specific business
   * @param {String} businessId - Sabito business ID
   * @param {Object} options - Query options (limit, offset, lastSyncedAt)
   * @returns {Promise<Array>} - Array of customer objects from Sabito
   */
  async fetchSabitoCustomers(businessId, options = {}) {
    if (!this.apiKey) {
      console.warn('[Sabito Sync] API key not configured');
      return [];
    }

    try {
      const params = {
        businessId: businessId,
        limit: options.limit || 100,
        offset: options.offset || 0
      };

      // If lastSyncedAt is provided, only fetch customers updated after that time
      if (options.lastSyncedAt) {
        params.updatedAfter = new Date(options.lastSyncedAt).toISOString();
      }

      const response = await axios.get(`${this.baseUrl}/api/customers`, {
        params,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      return response.data?.data || response.data || [];
    } catch (error) {
      console.error('[Sabito Sync] Error fetching customers from Sabito:', {
        businessId,
        error: error.message,
        response: error.response?.data
      });
      throw error;
    }
  }

  /**
   * Sync a single customer from Sabito to NEXPro
   * @param {Object} sabitoCustomer - Customer object from Sabito
   * @param {String} nexproTenantId - NEXPro tenant ID
   * @param {String} sabitoBusinessId - Sabito business ID
   * @returns {Promise<Object>} - Result object with status
   */
  async syncCustomer(sabitoCustomer, nexproTenantId, sabitoBusinessId) {
    try {
      const { id: sabitoCustomerId, email, name, phone, address, city, state, country, sourceReferralId, sourceType } = sabitoCustomer;

      if (!email) {
        return {
          success: false,
          skipped: true,
          reason: 'Customer missing email',
          sabitoCustomerId
        };
      }

      // Check if customer already exists (by email + tenantId or sabitoCustomerId)
      const { Op } = require('sequelize');
      const existingCustomer = await Customer.findOne({
        where: {
          tenantId: nexproTenantId,
          [Op.or]: [
            { email: email },
            { sabitoCustomerId: sabitoCustomerId }
          ]
        }
      });

      const customerData = {
        tenantId: nexproTenantId,
        name: name || 'Unknown',
        email: email,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || 'USA',
        sabitoCustomerId: sabitoCustomerId,
        sabitoSourceReferralId: sourceReferralId || null,
        sabitoSourceType: sourceType || 'referral',
        sabitoBusinessId: sabitoBusinessId,
        howDidYouHear: 'Sabito Referral',
        referralName: sourceReferralId ? 'From Sabito' : null,
        isActive: true
      };

      if (existingCustomer) {
        // Update existing customer
        await existingCustomer.update(customerData);
        return {
          success: true,
          action: 'updated',
          customerId: existingCustomer.id,
          sabitoCustomerId
        };
      } else {
        // Create new customer
        const newCustomer = await Customer.create(customerData);
        return {
          success: true,
          action: 'created',
          customerId: newCustomer.id,
          sabitoCustomerId
        };
      }
    } catch (error) {
      console.error('[Sabito Sync] Error syncing customer:', {
        sabitoCustomerId: sabitoCustomer.id,
        error: error.message
      });
      return {
        success: false,
        error: error.message,
        sabitoCustomerId: sabitoCustomer.id
      };
    }
  }

  /**
   * Sync all customers from Sabito for a specific tenant mapping
   * @param {Object} mapping - SabitoTenantMapping instance
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} - Sync result summary
   */
  async syncTenantCustomers(mapping, options = {}) {
    const { sabitoBusinessId, nexproTenantId, businessName } = mapping;
    
    console.log(`[Sabito Sync] Starting sync for business: ${businessName} (${sabitoBusinessId})`);

    try {
      // Get last sync time from metadata if available
      const lastSyncedAt = mapping.metadata?.lastSyncedAt || null;
      
      // Fetch customers from Sabito
      const sabitoCustomers = await this.fetchSabitoCustomers(sabitoBusinessId, {
        lastSyncedAt: options.fullSync ? null : lastSyncedAt
      });

      if (!sabitoCustomers || sabitoCustomers.length === 0) {
        console.log(`[Sabito Sync] No customers found for business: ${businessName}`);
        return {
          success: true,
          businessId: sabitoBusinessId,
          customersProcessed: 0,
          created: 0,
          updated: 0,
          errors: 0
        };
      }

      console.log(`[Sabito Sync] Found ${sabitoCustomers.length} customers to sync`);

      // Sync each customer
      const results = {
        success: true,
        businessId: sabitoBusinessId,
        customersProcessed: sabitoCustomers.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        errorDetails: []
      };

      for (const sabitoCustomer of sabitoCustomers) {
        const result = await this.syncCustomer(sabitoCustomer, nexproTenantId, sabitoBusinessId);
        
        if (result.success) {
          if (result.action === 'created') {
            results.created++;
          } else if (result.action === 'updated') {
            results.updated++;
          }
        } else {
          if (result.skipped) {
            results.skipped++;
          } else {
            results.errors++;
            results.errorDetails.push({
              sabitoCustomerId: result.sabitoCustomerId,
              error: result.error || result.reason
            });
          }
        }
      }

      // Update last sync time in mapping metadata
      await mapping.update({
        metadata: {
          ...mapping.metadata,
          lastSyncedAt: new Date().toISOString(),
          lastSyncResult: {
            customersProcessed: results.customersProcessed,
            created: results.created,
            updated: results.updated,
            skipped: results.skipped,
            errors: results.errors,
            errorDetails: results.errorDetails,
            syncedAt: new Date().toISOString()
          }
        }
      });

      console.log(`[Sabito Sync] Sync completed for ${businessName}:`, {
        processed: results.customersProcessed,
        created: results.created,
        updated: results.updated,
        skipped: results.skipped,
        errors: results.errors
      });

      return results;
    } catch (error) {
      console.error(`[Sabito Sync] Error syncing customers for business ${businessName}:`, error);
      return {
        success: false,
        businessId: sabitoBusinessId,
        error: error.message,
        customersProcessed: 0,
        created: 0,
        updated: 0,
        errors: 0,
        errorDetails: [error.message]
      };
    }
  }

  /**
   * Sync customers for all tenant mappings
   * @param {Object} options - Sync options
   * @returns {Promise<Array>} - Array of sync results for each tenant
   */
  async syncAllTenants(options = {}) {
    console.log('[Sabito Sync] Starting sync for all tenants...');

    try {
      // Get all active mappings
      // First get mappings, then filter by active tenant
      const allMappings = await SabitoTenantMapping.findAll({
        include: [{
          model: Tenant,
          as: 'tenant'
        }]
      });
      
      // Filter to only include mappings with active tenants
      const mappings = allMappings.filter(mapping => mapping.tenant && mapping.tenant.status === 'active');

      if (mappings.length === 0) {
        console.log('[Sabito Sync] No tenant mappings found');
        return [];
      }

      console.log(`[Sabito Sync] Found ${mappings.length} tenant mappings to sync`);

      const results = [];
      for (const mapping of mappings) {
        const result = await this.syncTenantCustomers(mapping, options);
        results.push(result);
        
        // Small delay between tenants to avoid overwhelming the API
        if (mappings.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const summary = {
        totalTenants: mappings.length,
        totalCreated: results.reduce((sum, r) => sum + (r.created || 0), 0),
        totalUpdated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
        totalErrors: results.reduce((sum, r) => sum + (r.errors || 0), 0)
      };

      console.log('[Sabito Sync] All tenants sync completed:', summary);
      return results;
    } catch (error) {
      console.error('[Sabito Sync] Error syncing all tenants:', error);
      throw error;
    }
  }
}

module.exports = new SabitoSyncService();

