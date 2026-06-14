const cron = require('node-cron');
const { processAllAutoReleaseCandidates } = require('./tradeAssuranceService');
const {
  processAvailableMarketplacePayouts,
  processProcessingMarketplacePayouts,
} = require('./marketplacePayoutService');

class MarketplacePayoutSchedulerService {
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
      cron: process.env.MARKETPLACE_PAYOUT_SCHEDULER_CRON || '*/10 * * * *',
      enabled: process.env.MARKETPLACE_PAYOUT_SCHEDULER_ENABLED !== 'false',
    };
  }

  async tick() {
    if (this.isRunning) {
      console.log('[MarketplacePayoutScheduler] Previous run still active, skipping');
      return;
    }

    this.isRunning = true;
    try {
      const autoReleased = await processAllAutoReleaseCandidates({ limit: 25 });
      const payoutSummary = await processAvailableMarketplacePayouts({
        limit: Number.parseInt(process.env.MARKETPLACE_PAYOUT_BATCH_LIMIT, 10) || 20,
      });
      const transferSummary = await processProcessingMarketplacePayouts({
        limit: Number.parseInt(process.env.MARKETPLACE_PAYOUT_BATCH_LIMIT, 10) || 20,
      });

      this.lastCompletedAt = new Date();
      this.lastSummary = {
        autoReleasedCount: autoReleased.length,
        payouts: payoutSummary,
        transfers: transferSummary,
      };
      this.lastError = null;

      console.log('[MarketplacePayoutScheduler] Completed tick:', this.lastSummary);
    } catch (error) {
      this.lastError = error?.message || String(error);
      console.error('[MarketplacePayoutScheduler] Tick failed:', this.lastError);
    } finally {
      this.isRunning = false;
    }
  }

  start() {
    if (this.started || process.env.MARKETPLACE_PAYOUT_SCHEDULER_ENABLED === 'false') {
      return;
    }

    this.started = true;
    const expression = process.env.MARKETPLACE_PAYOUT_SCHEDULER_CRON || '*/10 * * * *';
    cron.schedule(expression, () => this.tick());
    console.log(`[MarketplacePayoutScheduler] Scheduled job started (${expression})`);
  }
}

module.exports = new MarketplacePayoutSchedulerService();
