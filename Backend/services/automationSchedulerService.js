const cron = require('node-cron');
const { runDueAutomations } = require('./automationEngineService');

class AutomationSchedulerService {
  constructor() {
    this.isRunning = false;
    this.started = false;
    this.lastCompletedAt = null;
    this.lastError = null;
    this.lastSummary = null;
  }

  getStatus() {
    return {
      started: this.started,
      isRunning: this.isRunning,
      lastCompletedAt: this.lastCompletedAt,
      lastError: this.lastError,
      lastSummary: this.lastSummary,
      cron: process.env.AUTOMATION_SCHEDULER_CRON || '*/15 * * * *',
      enabled: process.env.AUTOMATION_SCHEDULER_ENABLED !== 'false'
    };
  }

  async tick() {
    if (this.isRunning) {
      console.log('[AutomationScheduler] Previous run still active, skipping');
      return;
    }
    this.isRunning = true;
    try {
      const summary = await runDueAutomations();
      this.lastCompletedAt = new Date();
      this.lastSummary = summary;
      this.lastError = null;
      console.log('[AutomationScheduler] Completed automation tick:', summary);
    } catch (error) {
      this.lastError = error?.message || String(error);
      console.error('[AutomationScheduler] Tick failed:', error?.message || error);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.started || process.env.AUTOMATION_SCHEDULER_ENABLED === 'false') return;
    this.started = true;
    const expression = process.env.AUTOMATION_SCHEDULER_CRON || '*/15 * * * *';
    cron.schedule(expression, () => this.tick());
    console.log(`[AutomationScheduler] Scheduled job started (${expression})`);
  }
}

module.exports = new AutomationSchedulerService();
