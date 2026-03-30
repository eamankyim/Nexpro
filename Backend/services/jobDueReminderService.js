const cron = require('node-cron');
const { Op } = require('sequelize');
const { Job, User, Customer, Tenant, Notification } = require('../models');
const emailService = require('./emailService');
const emailTemplates = require('./emailTemplates');
const {
  getPreferencesForUsers,
  isNotificationChannelEnabled
} = require('./notificationPreferenceHelper');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

/**
 * Job Due Reminder Service
 * Sends assignees an email when assigned jobs are due within 24 hours.
 */
class JobDueReminderService {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Send due-soon reminders to assignees.
   */
  async checkAndSendReminders() {
    if (this.isRunning) {
      console.log('[JobDueReminder] Already running, skipping...');
      return;
    }

    this.isRunning = true;
    console.log('[JobDueReminder] Starting due-soon reminder check...');

    try {
      const now = new Date();
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const jobsDueSoon = await Job.findAll({
        where: {
          dueDate: {
            [Op.gte]: now,
            [Op.lte]: next24Hours
          },
          status: {
            [Op.in]: ['new', 'in_progress', 'on_hold']
          },
          assignedTo: {
            [Op.ne]: null
          }
        },
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'name', 'email'],
            required: true
          },
          {
            model: Customer,
            as: 'customer',
            attributes: ['id', 'name', 'company'],
            required: false
          }
        ]
      });

      console.log(`[JobDueReminder] Found ${jobsDueSoon.length} job(s) due in next 24 hours`);

      let sentCount = 0;
      let skippedCount = 0;
      const tenantCache = new Map();
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

      for (const job of jobsDueSoon) {
        try {
          const assignee = job.assignedUser;
          if (!assignee?.email) {
            skippedCount++;
            continue;
          }

          const prefsMap = await getPreferencesForUsers([assignee.id]);
          const assigneePrefs = prefsMap.get(assignee.id);
          const emailEnabled = isNotificationChannelEnabled(assigneePrefs, 'job', 'email');
          const inAppEnabled = isNotificationChannelEnabled(assigneePrefs, 'job', 'in_app');
          if (!emailEnabled && !inAppEnabled) {
            skippedCount++;
            continue;
          }

          const existingReminder = await Notification.findOne({
            where: {
              tenantId: job.tenantId,
              userId: assignee.id,
              type: 'job_due_soon',
              createdAt: { [Op.gte]: startOfDay }
            },
            order: [['createdAt', 'DESC']]
          });

          if (existingReminder?.metadata?.jobId === job.id) {
            skippedCount++;
            continue;
          }

          let tenant = tenantCache.get(job.tenantId);
          if (!tenant) {
            tenant = await Tenant.findByPk(job.tenantId, {
              attributes: ['id', 'name', 'metadata']
            });
            tenantCache.set(job.tenantId, tenant || null);
          }

          const company = {
            name: tenant?.name || 'African Business Suite',
            logo: getTenantLogoUrl(tenant),
            primaryColor: tenant?.metadata?.primaryColor || '#166534'
          };

          const jobUrl = `${frontendUrl}/jobs/${job.id}`;
          const { subject, html, text } = emailTemplates.jobDueSoonReminder(
            job,
            assignee,
            job.customer,
            jobUrl,
            company
          );

          if (emailEnabled) {
            const emailResult = await emailService.sendMessage(job.tenantId, assignee.email, subject, html, text);
            if (!emailResult.success) {
              console.error(`[JobDueReminder] Email failed for job ${job.jobNumber}:`, emailResult.error);
              skippedCount++;
              continue;
            }
          }

          if (inAppEnabled) {
            await Notification.create({
              tenantId: job.tenantId,
              userId: assignee.id,
              type: 'job_due_soon',
              title: 'Job Due Soon',
              message: `${job.jobNumber || 'Assigned job'} is due soon.`,
              priority: job.priority === 'urgent' ? 'high' : 'normal',
              metadata: {
                jobId: job.id,
                jobNumber: job.jobNumber,
                dueDate: job.dueDate
              },
              channels: emailEnabled ? ['in_app', 'email'] : ['in_app'],
              icon: 'ClockCircleOutlined',
              link: `/jobs/${job.id}`
            });
          }

          sentCount++;
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[JobDueReminder] Error processing job ${job.jobNumber || job.id}:`, error);
          skippedCount++;
        }
      }

      console.log(`[JobDueReminder] Completed. Sent: ${sentCount}, Skipped: ${skippedCount}`);
    } catch (error) {
      console.error('[JobDueReminder] Error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Start scheduled reminders.
   */
  start() {
    // Run daily at 8 AM.
    cron.schedule('0 8 * * *', () => {
      this.checkAndSendReminders();
    });

    console.log('[JobDueReminder] Scheduled job started (runs daily at 8 AM)');
  }
}

module.exports = new JobDueReminderService();
