const DEFAULT_TASK_AUTOMATION = {
  leadFollowUpToTask: true,
  invoiceOverdueToTask: true,
  quoteNoResponseToTask: true,
  lowStockToTask: true,
  quoteNoResponseDays: 3
};

function normalizeTaskAutomation(raw = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const quoteNoResponseDays = Number.parseInt(src.quoteNoResponseDays, 10);
  return {
    leadFollowUpToTask: src.leadFollowUpToTask !== false,
    invoiceOverdueToTask: src.invoiceOverdueToTask === true,
    quoteNoResponseToTask: src.quoteNoResponseToTask === true,
    lowStockToTask: src.lowStockToTask === true,
    quoteNoResponseDays: Number.isFinite(quoteNoResponseDays)
      ? Math.max(1, Math.min(30, quoteNoResponseDays))
      : DEFAULT_TASK_AUTOMATION.quoteNoResponseDays
  };
}

module.exports = {
  DEFAULT_TASK_AUTOMATION,
  normalizeTaskAutomation
};
