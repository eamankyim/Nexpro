const {
  ANALYSIS_INTENT_IDS,
  FALLBACK_SUGGESTED_QUESTIONS,
  getFallbackSuggestedQuestions,
} = require('./intentCatalog');

/**
 * Rules-first intent classifier (regex / keywords). No LLM.
 * Returns analysis intents, support/draft routing, or unsupported.
 *
 * @param {string} message
 * @param {{ pageContext?: string, businessType?: string }} [options]
 * @returns {{
 *   intent: string | null,
 *   confidence: number,
 *   route: 'analysis' | 'support' | 'draft' | 'unsupported',
 *   suggestedQuestions?: string[],
 * }}
 */
function classifyIntent(message, options = {}) {
  const text = String(message || '').trim().toLowerCase();
  const suggestions = getFallbackSuggestedQuestions(options.businessType);
  if (!text) {
    return {
      intent: null,
      confidence: 0,
      route: 'unsupported',
      suggestedQuestions: suggestions,
    };
  }

  // Support / how-to — keep Claude path
  if (
    /\b(how do i|how to|where (is|can|do)|help me (set|add|create|find|use)|show me how|navigate|steps to|walk me through)\b/.test(text)
    || /\b(create an? invoice|record a payment|add an? expense|add a customer|run (a |the )?pos|make a (new )?sale|create a job|dispense)\b/.test(text)
  ) {
    return { intent: 'support_howto', confidence: 0.85, route: 'support' };
  }

  // Draft / compose — keep Claude path
  if (
    /\b(draft|write|compose|write me|craft)\b/.test(text)
    && /\b(reminder|message|email|sms|whatsapp|thank[- ]?you|promotional|promo|newsletter|template|job[- ]?ready|pickup)\b/.test(text)
  ) {
    return { intent: 'draft_message', confidence: 0.85, route: 'draft' };
  }

  // Why sales down — check before generic sales compare
  if (
    /\b(why|what caused|reason|reasons)\b/.test(text)
    && /\b(sales?|revenue|performance)\b/.test(text)
    && /\b(down|drop(ped|ping)?|declin(e|ed|ing)|lower|fell|fall(ing)?|decreas(e|ed|ing)|slow)\b/.test(text)
  ) {
    return { intent: 'why_sales_down', confidence: 0.92, route: 'analysis' };
  }

  // Receivables / who owes
  if (
    /\b(who owes|owes me|outstanding|receivables?|overdue invoices?|unpaid invoices?|who has overdue)\b/.test(text)
    || /\b(debtors?|money owed|balances? due)\b/.test(text)
  ) {
    if (/\bwho owes\b/.test(text) || /\bowes me\b/.test(text)) {
      return { intent: 'who_owes_me', confidence: 0.93, route: 'analysis' };
    }
    return { intent: 'receivables_summary', confidence: 0.9, route: 'analysis' };
  }

  // Low stock / restock
  if (
    /\b(low stock|out of stock|restock|reorder|running low|stock alerts?|what (should|can) i (restock|reorder)|drugs? or products are low)\b/.test(text)
    || (/\b(stock|inventory)\b/.test(text) && /\b(low|alert|short|need)\b/.test(text))
  ) {
    return { intent: 'low_stock', confidence: 0.9, route: 'analysis' };
  }

  // Top products
  if (
    /\b(top products?|best[- ]?sell(er|ing)|top sell(er|ing)|biggest (revenue )?drivers?|what('s| is| are) (my )?top)\b/.test(text)
    || (/\bproducts?\b/.test(text) && /\b(top|best|leading|highest)\b/.test(text))
  ) {
    return { intent: 'top_products', confidence: 0.9, route: 'analysis' };
  }

  // Sales vs prior period
  if (
    /\b(compare|vs\.?|versus|against|previous period|prior period|last (month|week|period)|vs last)\b/.test(text)
    && /\b(sales?|revenue|period|performance|this (month|week|period))\b/.test(text)
  ) {
    return { intent: 'sales_vs_prior_period', confidence: 0.88, route: 'analysis' };
  }

  // Sales today
  if (
    /\b(today|todays)\b/.test(text)
    && /\b(sales?|sold|revenue|performance|earn(ed|ings)?|take[- ]?home|how much|did i make)\b/.test(text)
  ) {
    return { intent: 'sales_today', confidence: 0.9, route: 'analysis' };
  }
  if (/^(how much (did i )?(sell|make)|sales today|today'?s sales)\b/.test(text)) {
    return { intent: 'sales_today', confidence: 0.88, route: 'analysis' };
  }

  // Sales this month
  if (
    /\b(this month|month'?s)\b/.test(text)
    && /\b(sales?|sold|revenue|performance|earn(ed|ings)?|how (are|is)|summarize)\b/.test(text)
  ) {
    return { intent: 'sales_this_month', confidence: 0.88, route: 'analysis' };
  }

  // Performance summary (dashboard-friendly) — before job phrases so "summarize performance" wins
  if (
    /\b(summarize|summary|overview|how (is|are) (my |the )?business|performance summary|dashboard insight)\b/.test(text)
    || (options.pageContext === 'dashboard' && /\b(summarize|insight|focus|performance)\b/.test(text))
  ) {
    // Job-pipeline phrasing without performance → leave for support/Anthropic
    if (/\b(open jobs?|job pipeline|jobs? (still )?need|which jobs)\b/.test(text) && !/\bperformance\b/.test(text)) {
      return { intent: 'support_howto', confidence: 0.55, route: 'support' };
    }
    return { intent: 'performance_summary', confidence: 0.82, route: 'analysis' };
  }

  // Explicit performance_summary prompt from dashboard card
  if (/\bperformance_summary\b/.test(text) || text === 'performance summary') {
    return { intent: 'performance_summary', confidence: 0.99, route: 'analysis' };
  }

  // Job / pipeline phrasing (studio) — Anthropic support path until dedicated job metrics exist
  if (/\b(open jobs?|job pipeline|jobs? (still )?need|which jobs|outstanding jobs?)\b/.test(text)) {
    return { intent: 'support_howto', confidence: 0.6, route: 'support' };
  }

  // Bare greetings are handled by smallTalk in assistant chat (before this classifier).
  // Analysis API still maps them to unsupported with suggestions below.

  // Predictions / forecasts — not Phase 1 analysis
  if (/\b(predict|forecast|next week|will i sell)\b/.test(text)) {
    return {
      intent: null,
      confidence: 0.4,
      route: 'unsupported',
      suggestedQuestions: suggestions,
    };
  }

  return {
    intent: null,
    confidence: 0.2,
    route: 'unsupported',
    suggestedQuestions: suggestions,
  };
}

/**
 * @param {string|null} intentId
 * @returns {boolean}
 */
function isAnalysisIntent(intentId) {
  return ANALYSIS_INTENT_IDS.has(intentId);
}

module.exports = {
  classifyIntent,
  isAnalysisIntent,
};
