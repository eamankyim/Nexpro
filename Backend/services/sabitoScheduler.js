const cron = require('node-cron');
const sabitoSyncService = require('./sabitoSyncService');

/**
 * Scheduler for periodic Sabito customer sync
 */
class SabitoScheduler {
  constructor() {
    this.jobs = [];
    this.isEnabled = process.env.SABITO_SYNC_ENABLED !== 'false'; // Enabled by default
    this.syncInterval = process.env.SABITO_SYNC_INTERVAL || '0 */6 * * *'; // Every 6 hours by default
  }

  /**
   * Start the scheduler
   */
  start() {
    if (!this.isEnabled) {
      console.log('[Sabito Scheduler] Sync is disabled (SABITO_SYNC_ENABLED=false)');
      return;
    }

    console.log(`[Sabito Scheduler] Starting scheduler with interval: ${this.syncInterval}`);

    // Schedule periodic sync
    const job = cron.schedule(this.syncInterval, async () => {
      console.log('[Sabito Scheduler] Running scheduled sync...');
      try {
        await sabitoSyncService.syncAllTenants({ fullSync: false });
        console.log('[Sabito Scheduler] Scheduled sync completed successfully');
      } catch (error) {
        console.error('[Sabito Scheduler] Scheduled sync failed:', error);
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    this.jobs.push(job);

    // Run initial sync on startup (optional, can be disabled)
    if (process.env.SABITO_SYNC_ON_STARTUP !== 'false') {
      console.log('[Sabito Scheduler] Running initial sync on startup...');
      setTimeout(async () => {
        try {
          await sabitoSyncService.syncAllTenants({ fullSync: false });
          console.log('[Sabito Scheduler] Initial sync completed');
        } catch (error) {
          console.error('[Sabito Scheduler] Initial sync failed:', error);
        }
      }, 5000); // Wait 5 seconds after server startup
    }

    console.log('[Sabito Scheduler] Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.jobs.forEach(job => job.stop());
    this.jobs = [];
    console.log('[Sabito Scheduler] Scheduler stopped');
  }

  /**
   * Manually trigger a sync
   * @param {Object} options - Sync options
   * @returns {Promise<Array>} - Sync results
   */
  async triggerSync(options = {}) {
    console.log('[Sabito Scheduler] Manual sync triggered');
    return await sabitoSyncService.syncAllTenants(options);
  }
}

module.exports = new SabitoScheduler();




