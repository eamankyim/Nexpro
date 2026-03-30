const cron = require('node-cron');
const { Invoice, Customer, Tenant, Setting } = require('../models');
const { Op } = require('sequelize');
const whatsappService = require('./whatsappService');
const whatsappTemplates = require('./whatsappTemplates');
const activityLogger = require('./activityLogger');
const smsService = require('./smsService');
const emailService = require('./emailService');
const emailTemplates = require('./emailTemplates');
const taskAutomationService = require('./taskAutomationService');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

/**
 * Payment Reminder Service
 * Sends WhatsApp and/or SMS reminders for overdue invoices
 * Runs daily at 9 AM
 */
class PaymentReminderService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Build short SMS message for overdue invoice (under 160 chars when possible)
   */
  buildPaymentReminderSms(invoice, paymentLink) {
    const invNum = invoice.invoiceNumber || `#${invoice.id}`;
    const balance = parseFloat(invoice.balance);
    const amount = Number.isFinite(balance) ? `GHS ${balance.toFixed(2)}` : 'outstanding';
    const msg = `Overdue: Invoice ${invNum}. Balance ${amount}. Pay: ${paymentLink}`;
    return msg.substring(0, 160);
  }

  /**
   * Check for overdue invoices and send reminders (WhatsApp and/or SMS)
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
          try {
            await taskAutomationService.createInvoiceOverdueTask({
              invoice,
              tenantId: invoice.tenantId,
              triggeredBy: null
            });
          } catch (taskError) {
            console.error('[PaymentReminder] Failed to auto-create overdue invoice task:', taskError?.message);
          }

          if (!invoice.customer || !invoice.customer.phone) {
            skippedCount++;
            continue;
          }

          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
          const paymentLink = invoice.paymentToken
            ? `${frontendUrl}/pay-invoice/${invoice.paymentToken}`
            : `${frontendUrl}/invoices/${invoice.id}`;

          let reminderSent = false;

          // Send WhatsApp if enabled
          const whatsappConfig = await whatsappService.getConfig(invoice.tenantId);
          if (whatsappConfig && whatsappConfig.enabled) {
            const phoneNumber = whatsappService.validatePhoneNumber(invoice.customer.phone);
            if (phoneNumber && whatsappService.checkRateLimit(invoice.tenantId)) {
              const parameters = whatsappTemplates.preparePaymentReminder(invoice, paymentLink);
              const result = await whatsappService.sendMessage(
                invoice.tenantId,
                phoneNumber,
                'payment_reminder',
                parameters
              );
              if (result.success) {
                reminderSent = true;
                console.log(`[PaymentReminder] WhatsApp reminder sent for invoice ${invoice.invoiceNumber}`);
              } else {
                console.error(`[PaymentReminder] WhatsApp failed for ${invoice.invoiceNumber}:`, result.error);
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Send SMS if enabled (tenant or platform)
          const smsConfig = await smsService.getResolvedConfig(invoice.tenantId);
          if (smsConfig) {
            const smsPhone = smsService.validatePhoneNumber(invoice.customer.phone);
            if (smsPhone && smsService.checkRateLimit(invoice.tenantId)) {
              const smsMessage = this.buildPaymentReminderSms(invoice, paymentLink);
              const smsResult = await smsService.sendMessage(invoice.tenantId, smsPhone, smsMessage);
              if (smsResult.success) {
                reminderSent = true;
                console.log(`[PaymentReminder] SMS reminder sent for invoice ${invoice.invoiceNumber}`);
              } else {
                console.error(`[PaymentReminder] SMS failed for ${invoice.invoiceNumber}:`, smsResult.error);
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Send email if enabled (optional setting)
          const prefsRow = await Setting.findOne({ where: { tenantId: invoice.tenantId, key: 'customer-notification-preferences' } });
          const prefs = prefsRow?.value || {};
          if (prefs.sendPaymentReminderEmail === true && invoice.customer?.email) {
            const emailConfig = await emailService.getConfig(invoice.tenantId);
            if (emailConfig) {
              const tenant = await Tenant.findByPk(invoice.tenantId);
              const company = {
                name: tenant?.name || 'African Business Suite',
                logo: getTenantLogoUrl(tenant),
                primaryColor: tenant?.metadata?.primaryColor || '#166534'
              };
              const balance = parseFloat(invoice.balance);
              const invoiceForEmail = {
                ...invoice.toJSON(),
                total: Number.isFinite(balance) ? balance : (parseFloat(invoice.totalAmount) || 0),
                invoiceNumber: invoice.invoiceNumber,
                currency: invoice.currency || 'GHS',
                dueDate: invoice.dueDate
              };
              const { subject, html, text } = emailTemplates.paymentReminder(invoiceForEmail, invoice.customer, paymentLink, company, 'overdue');
              const emailResult = await emailService.sendMessage(invoice.tenantId, invoice.customer.email, subject, html, text);
              if (emailResult.success) {
                reminderSent = true;
                console.log(`[PaymentReminder] Email reminder sent for invoice ${invoice.invoiceNumber}`);
              } else {
                console.error(`[PaymentReminder] Email failed for ${invoice.invoiceNumber}:`, emailResult.error);
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          if (reminderSent) {
            sentCount++;
            if (invoice.status !== 'overdue') {
              await invoice.update({ status: 'overdue' });
              try {
                await activityLogger.logInvoiceOverdue(invoice, null);
              } catch (logErr) {
                console.error('[PaymentReminder] logInvoiceOverdue failed:', logErr?.message);
              }
            }
          } else {
            skippedCount++;
          }
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
