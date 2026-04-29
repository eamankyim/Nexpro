const cron = require('node-cron');
const recurringJournalService = require('./recurringJournalService');

class RecurringJournalSchedulerService {
  constructor() {
    this.isRunning = false;
  }

  async run() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const result = await recurringJournalService.runDueSchedules();
      console.log('[RecurringJournalScheduler] Completed run', {
        processed: result.processed,
        results: result.results?.length || 0
      });
    } catch (error) {
      console.error('[RecurringJournalScheduler] Failed:', error?.message || error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    cron.schedule('10 1 * * *', () => {
      this.run();
    });
    console.log('[RecurringJournalScheduler] Scheduled job started (runs daily at 1:10 AM)');
  }
}

module.exports = new RecurringJournalSchedulerService();
