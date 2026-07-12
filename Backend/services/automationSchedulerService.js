const cron = require('node-cron');
const { runDueAutomations, processDueDelayedRuns } = require('./automationEngineService');

class AutomationSchedulerService {
  constructor() {
    this.isRunning = false;
    this.isDelayedRunning = false;
    this.started = false;
    this.lastCompletedAt = null;
    this.lastDelayedCompletedAt = null;
    this.lastError = null;
    this.lastDelayedError = null;
    this.lastSummary = null;
    this.lastDelayedSummary = null;
  }

  getStatus() {
    return {
      started: this.started,
      isRunning: this.isRunning,
      isDelayedRunning: this.isDelayedRunning,
      lastCompletedAt: this.lastCompletedAt,
      lastDelayedCompletedAt: this.lastDelayedCompletedAt,
      lastError: this.lastError,
      lastDelayedError: this.lastDelayedError,
      lastSummary: this.lastSummary,
      lastDelayedSummary: this.lastDelayedSummary,
      cron: process.env.AUTOMATION_SCHEDULER_CRON || '*/15 * * * *',
      delayedCron: process.env.AUTOMATION_DELAYED_CRON || '* * * * *',
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

  /**
   * Process pending Send-after delayed runs every minute (independent of sticky cron).
   */
  async tickDelayed() {
    if (this.isDelayedRunning) {
      console.log('[AutomationScheduler] Previous delayed run still active, skipping');
      return;
    }
    this.isDelayedRunning = true;
    try {
      const summary = await processDueDelayedRuns();
      this.lastDelayedCompletedAt = new Date();
      this.lastDelayedSummary = summary;
      this.lastDelayedError = null;
      if (summary.checked > 0) {
        console.log('[AutomationScheduler] Completed delayed runs tick:', summary);
      }
    } catch (error) {
      this.lastDelayedError = error?.message || String(error);
      console.error('[AutomationScheduler] Delayed tick failed:', error?.message || error);
    } finally {
      this.isDelayedRunning = false;
    }
  }

  start() {
    if (this.started || process.env.AUTOMATION_SCHEDULER_ENABLED === 'false') return;
    this.started = true;
    const expression = process.env.AUTOMATION_SCHEDULER_CRON || '*/15 * * * *';
    const delayedExpression = process.env.AUTOMATION_DELAYED_CRON || '* * * * *';
    cron.schedule(expression, () => this.tick());
    cron.schedule(delayedExpression, () => this.tickDelayed());
    console.log(`[AutomationScheduler] Scheduled job started (${expression}); delayed runs (${delayedExpression})`);
  }
}

module.exports = new AutomationSchedulerService();
