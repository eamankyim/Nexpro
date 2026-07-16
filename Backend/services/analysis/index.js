/**
 * Owned analysis engine — source of truth for business numbers.
 * Ask AI maps questions → intents → this module → templated answer + reasons.
 * No Anthropic on the analysis path.
 */

const { ANALYSIS_INTENTS, FALLBACK_SUGGESTED_QUESTIONS, getIntentById } = require('./intentCatalog');
const { classifyIntent, isAnalysisIntent } = require('./intentClassifier');
const { runAnalysis, buildUnsupportedResponse } = require('./analysisOrchestrator');
const { buildSalesDropReasons } = require('./reasons/salesDrop');
const {
  computeAlignedProfit,
  isRetailBusinessType,
  roundMoney,
  percentChange,
} = require('./profitFormulas');

module.exports = {
  ANALYSIS_INTENTS,
  FALLBACK_SUGGESTED_QUESTIONS,
  getIntentById,
  classifyIntent,
  isAnalysisIntent,
  runAnalysis,
  buildUnsupportedResponse,
  buildSalesDropReasons,
  computeAlignedProfit,
  isRetailBusinessType,
  roundMoney,
  percentChange,
};
