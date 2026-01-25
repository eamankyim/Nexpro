const cron = require('node-cron');
const { Invoice, Customer, Tenant } = require('../models');
const { Op } = require('sequelize');
const whatsappService = require('./whatsappService');
const whatsappTemplates = require('./whatsappTemplates');

/**
 * Payment Reminder Service
 * Sends WhatsApp reminders for overdue invoices
 * Runs daily at 9 AM
 */
class PaymentReminderService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Check for overdue invoices and send reminders
   */
  async checkAndSendReminders() {
    if (this.isRunning) {
      console.log('[PaymentReminder] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[PaymentReminder] Starting payment reminder check...');

    try {
      // Find all overdue invoices (status: sent, partial, or overdue, with balance > 0)
      // Group by tenant to process efficiently
      const overdueInvoices = await Invoice.findAll({
        where: {
          status: { [Op.in]: ['sent', 'partial', 'overdue'] },
          balance: { [Op.gt]: 0 },
          dueDate: { [Op.lt]: new Date() }
        },
        include: [
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'phone', 'email'],
            required: false
          }
        ]
      });

      console.log(`[PaymentReminder] Found ${overdueInvoices.length} overdue invoices`);

      let sentCount = 0;
      let skippedCount = 0;

      for (const invoice of overdueInvoices) {
        try {
          // Check if WhatsApp is enabled for this tenant
          const config = await whatsappService.getConfig(invoice.tenantId);
          if (!config || !config.enabled) {
            skippedCount++;
            continue;
          }

          // Check if customer has phone number
          if (!invoice.customer || !invoice.customer.phone) {
            skippedCount++;
            continue;
          }

          // Validate phone number
          const phoneNumber = whatsappService.validatePhoneNumber(invoice.customer.phone);
          if (!phoneNumber) {
            skippedCount++;
            continue;
          }

          // Check rate limit
          if (!whatsappService.checkRateLimit(invoice.tenantId)) {
            console.log(`[PaymentReminder] Rate limit reached for tenant ${invoice.tenantId}`);
            break; // Stop processing for this tenant
          }

          // Generate payment link
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const paymentLink = invoice.paymentToken 
            ? `${frontendUrl}/pay-invoice/${invoice.paymentToken}`
            : `${frontendUrl}/invoices/${invoice.id}`;

          // Prepare template parameters
          const parameters = whatsappTemplates.preparePaymentReminder(invoice, paymentLink);

          // Send WhatsApp message
          const result = await whatsappService.sendMessage(
            invoice.tenantId,
            phoneNumber,
            'payment_reminder',
            parameters
          );

          if (result.success) {
            sentCount++;
            console.log(`[PaymentReminder] Sent reminder for invoice ${invoice.invoiceNumber}`);
            
            // Update invoice status to overdue if not already
            if (invoice.status !== 'overdue') {
              await invoice.update({ status: 'overdue' });
            }
          } else {
            console.error(`[PaymentReminder] Failed to send reminder for invoice ${invoice.invoiceNumber}:`, result.error);
            skippedCount++;
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`[PaymentReminder] Error processing invoice ${invoice.invoiceNumber}:`, error);
          skippedCount++;
        }
      }

      console.log(`[PaymentReminder] Completed. Sent: ${sentCount}, Skipped: ${skippedCount}`);
      
    } catch (error) {
      console.error('[PaymentReminder] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start the scheduled job
   */
  start() {
    // Run daily at 9 AM
    cron.schedule('0 9 * * *', () => {
      this.checkAndSendReminders();
    });

    console.log('[PaymentReminder] Scheduled job started (runs daily at 9 AM)');
  }

  /**
   * Stop the scheduled job
   */
  stop() {
    // Cron jobs can't be easily stopped, but we can prevent execution
    this.isRunning = true;
    console.log('[PaymentReminder] Service stopped');
  }
}

module.exports = new PaymentReminderService();
