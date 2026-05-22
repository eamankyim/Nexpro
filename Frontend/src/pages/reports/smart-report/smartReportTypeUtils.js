import {
  SMART_REPORT_TABS,
  SMART_REPORT_TAB_IDS,
  SMART_REPORT_TAB_DESCRIPTIONS,
  SMART_REPORT_TYPE_GROUPS,
  LEGACY_REPORT_TYPE_TO_TAB,
} from './smartReportConstants';

/**
 * Tab metadata by id.
 * @param {string} tabId
 */
export function getSmartReportTabMeta(tabId) {
  const tab = SMART_REPORT_TABS.find((t) => t.id === tabId);
  if (!tab) return { id: tabId, label: tabId, icon: null, description: '' };
  return {
    ...tab,
    description: SMART_REPORT_TAB_DESCRIPTIONS[tabId] || '',
  };
}

/**
 * Report section options for the create modal, filtered by business type.
 * @param {{ isShop?: boolean, isPharmacy?: boolean, isStudio?: boolean }} ctx
 */
export function getSmartReportTypeOptionsGrouped(ctx = {}) {
  return SMART_REPORT_TYPE_GROUPS
    .filter((group) => !group.showWhen || group.showWhen(ctx))
    .map((group) => ({
      groupLabel: group.groupLabel,
      options: group.tabIds
        .map((tabId) => {
          const meta = getSmartReportTabMeta(tabId);
          return {
            value: tabId,
            label: meta.label,
            description: meta.description,
          };
        }),
    }))
    .filter((group) => group.options.length > 0);
}

/**
 * Default tab selection when opening the create report modal.
 * @param {{ isShop?: boolean, isPharmacy?: boolean, isStudio?: boolean }} ctx
 * @returns {string[]}
 */
export function getDefaultSmartReportTypeSelection(ctx = {}) {
  return getSmartReportTypeOptionsGrouped(ctx).flatMap((g) => g.options.map((o) => o.value));
}

/**
 * Normalize legacy report type ids to Smart Report tab ids.
 * @param {string[]} types
 * @returns {string[]}
 */
export function normalizeLegacyReportTypes(types = []) {
  const normalized = new Set();
  types.forEach((type) => {
    if (SMART_REPORT_TAB_IDS.includes(type)) {
      normalized.add(type);
      return;
    }
    const mapped = LEGACY_REPORT_TYPE_TO_TAB[type];
    if (!mapped) return;
    (Array.isArray(mapped) ? mapped : [mapped]).forEach((tabId) => normalized.add(tabId));
  });
  return [...normalized];
}

/**
 * Infer tab ids from legacy insight sections.
 * @param {Array<{ type?: string }>} insights
 * @returns {string[]}
 */
export function inferTabIdsFromInsights(insights = []) {
  const types = [];
  insights.forEach((insight) => {
    if (!insight?.type) return;
    if (insight.type === 'performance') types.push('executive');
    else if (LEGACY_REPORT_TYPE_TO_TAB[insight.type]) {
      const mapped = LEGACY_REPORT_TYPE_TO_TAB[insight.type];
      (Array.isArray(mapped) ? mapped : [mapped]).forEach((id) => types.push(id));
    } else if (insight.type === 'ai-analysis' || insight.type === 'strategy') {
      types.push('ai-insights');
    } else if (['recommendation', 'opportunity'].includes(insight.type)) {
      types.push('recommendations');
    }
  });
  return normalizeLegacyReportTypes(types);
}

/**
 * Tabs available for a tenant business type (inventory only for retail).
 * @param {{ isShop?: boolean, isPharmacy?: boolean }} ctx
 */
export function getAvailableSmartReportTabs(ctx = {}) {
  const { isShop = false, isPharmacy = false } = ctx;
  return SMART_REPORT_TABS.filter((tab) => {
    if (tab.id === 'inventory') return isShop || isPharmacy;
    return true;
  });
}

/**
 * Resolve which tabs to show for a saved/generated report.
 * @param {Object} report
 * @param {{ isShop?: boolean, isPharmacy?: boolean, isStudio?: boolean }} ctx
 * @returns {Array<{ id: string, label: string, icon: import('react').ComponentType }>}
 */
export function resolveSmartReportTabs(report, ctx = {}) {
  const available = getAvailableSmartReportTabs(ctx);
  const availableIds = new Set(available.map((t) => t.id));

  let selectedIds = [];
  if (Array.isArray(report?.reportTypes) && report.reportTypes.length > 0) {
    selectedIds = normalizeLegacyReportTypes(report.reportTypes);
  } else if (Array.isArray(report?.insights) && report.insights.length > 0) {
    selectedIds = inferTabIdsFromInsights(report.insights);
  } else {
    return available;
  }

  const filtered = available.filter((tab) => selectedIds.includes(tab.id));
  return filtered.length > 0 ? filtered : available;
}

/**
 * Display labels for report list badges.
 * @param {Object} report
 * @param {{ isShop?: boolean, isPharmacy?: boolean, isStudio?: boolean }} ctx
 * @returns {string[]}
 */
export function getSmartReportTypeLabels(report, ctx = {}) {
  const tabs = resolveSmartReportTabs(report, ctx);
  return tabs.map((t) => t.label);
}
