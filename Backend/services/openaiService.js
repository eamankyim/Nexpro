let _anthropic = null;

/** Lazy-init Anthropic client for Claude; null if ANTHROPIC_API_KEY is not set. */
function getAnthropic() {
  if (_anthropic !== null) return _anthropic;
  let key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  key = key.replace(/\r?\n/g, '');
  if (!key) return null;
  const { Anthropic } = require('@anthropic-ai/sdk');
  _anthropic = new Anthropic({ apiKey: key });
  return _anthropic;
}

/** Require Anthropic client; throws if ANTHROPIC_API_KEY is not set. All AI features use Claude. */
function requireAnthropic() {
  const client = getAnthropic();
  if (!client) {
    const err = new Error('AI is not configured. Set ANTHROPIC_API_KEY in .env to use AI features.');
    err.code = 'OPENAI_NOT_CONFIGURED';
    throw err;
  }
  return client;
}

/**
 * Generate AI-powered insights and recommendations for business report
 * @param {Object} reportData - The report data to analyze
 * @param {Object} options - Additional options (businessType, period, etc.)
 * @returns {Promise<Object>} AI-generated insights, recommendations, and analysis
 */
// Display names for AI prompts (user-friendly)
const BUSINESS_DISPLAY_NAMES = {
  printing_press: 'printing press',
  mechanic: 'auto repair / mechanic',
  barber: 'barber',
  salon: 'salon',
  shop: 'retail shop',
  pharmacy: 'pharmacy',
  studio: 'service business'
};

const analyzeReportData = async (reportData, options = {}) => {
  try {
    const {
      businessType = 'printing_press',
      studioType,
      period = 'monthly',
      startDate,
      endDate,
      customQuestion
    } = options;

    const effectiveType = studioType || businessType;

    // Map business type to terminology (supports studio types: mechanic, barber, salon)
    const businessTerminology = {
      printing_press: {
        items: 'services',
        sales: 'jobs',
        revenue: 'service revenue',
        analytics: 'service performance'
      },
      mechanic: {
        items: 'repairs',
        sales: 'repairs',
        revenue: 'repair revenue',
        analytics: 'repair performance'
      },
      barber: {
        items: 'services',
        sales: 'appointments',
        revenue: 'service revenue',
        analytics: 'service performance'
      },
      salon: {
        items: 'services',
        sales: 'appointments',
        revenue: 'service revenue',
        analytics: 'service performance'
      },
      shop: {
        items: 'products',
        sales: 'sales',
        revenue: 'product revenue',
        analytics: 'product performance'
      },
      pharmacy: {
        items: 'drugs',
        sales: 'prescriptions',
        revenue: 'prescription revenue',
        analytics: 'drug performance'
      }
    };

    const terms = businessTerminology[effectiveType] || businessTerminology.printing_press;
    const displayName = BUSINESS_DISPLAY_NAMES[effectiveType] || effectiveType;

    // Prepare structured data summary for AI
    const dataSummary = {
      financial: {
        revenue: reportData.revenue || 0,
        expenses: reportData.expenses || 0,
        profit: (reportData.revenue || 0) - (reportData.expenses || 0),
        profitMargin: reportData.profitMargin || 0,
        revenueChange: reportData.revenueChange || 0,
        expenseChange: reportData.expenseChange || 0
      },
      period: {
        startDate,
        endDate,
        type: period
      },
      businessType: effectiveType,
      topItems: reportData.topItems || [],
      expenseBreakdown: reportData.expenseBreakdown || [],
      materials: reportData.materials || null,
      outstandingPayments: reportData.outstandingPayments || 0
    };

    // Create comprehensive prompt for AI analysis
    const systemPrompt = `You are an expert business analyst specializing in ${displayName} operations. Analyze the provided business data and generate actionable insights, recommendations, and strategic suggestions. Be specific, data-driven, and practical.`;

    const userPrompt = `Analyze the following business report data for a ${displayName} business and provide:

1. **Key Findings** (3-5 bullet points highlighting the most important insights)
2. **Performance Analysis** (detailed analysis of revenue, expenses, and profitability trends)
3. **Actionable Recommendations** (5-7 specific, prioritized recommendations with expected impact)
4. **Risk Assessment** (identify potential risks and concerns)
5. **Growth Opportunities** (suggest specific opportunities for growth and improvement)
6. **Strategic Suggestions** (long-term strategic advice based on the data patterns)

Business Data Summary:
- Revenue: GHS ${dataSummary.financial.revenue.toLocaleString()}
- Expenses: GHS ${dataSummary.financial.expenses.toLocaleString()}
- Net Profit: GHS ${dataSummary.financial.profit.toLocaleString()}
- Profit Margin: ${dataSummary.financial.profitMargin.toFixed(2)}%
- Revenue Change: ${dataSummary.financial.revenueChange >= 0 ? '+' : ''}${dataSummary.financial.revenueChange.toFixed(2)}%
- Expense Change: ${dataSummary.financial.expenseChange >= 0 ? '+' : ''}${dataSummary.financial.expenseChange.toFixed(2)}%
- Period: ${startDate} to ${endDate}
- Outstanding Payments: GHS ${dataSummary.outstandingPayments.toLocaleString()}

${dataSummary.topItems.length > 0 ? `Top Performing ${terms.items}: ${dataSummary.topItems.slice(0, 5).map(item => `${item.name || item.item} (Revenue: GHS ${(item.revenue || 0).toLocaleString()})`).join(', ')}` : ''}

${dataSummary.expenseBreakdown.length > 0 ? `Expense Breakdown: ${dataSummary.expenseBreakdown.map(exp => `${exp.category}: GHS ${exp.amount.toLocaleString()}`).join(', ')}` : ''}

${dataSummary.materials ? `Materials Status: ${dataSummary.materials.totalStocks} total items, ${dataSummary.materials.stockAvailabilityRate}% availability rate` : ''}
${customQuestion ? `\nThe user also asked: "${customQuestion}". Address this question specifically in your analysis.` : ''}

Provide your analysis in a structured JSON format with the following keys:
- keyFindings: array of strings
- performanceAnalysis: string (detailed paragraph)
- recommendations: array of objects with {priority: "High|Medium|Low", action: string, impact: string, reasoning: string}
- riskAssessment: array of objects with {risk: string, severity: "High|Medium|Low", mitigation: string}
- growthOpportunities: array of objects with {opportunity: string, potentialImpact: string, actionSteps: string[]}
- strategicSuggestions: array of strings

Be specific, actionable, and data-driven. Use the actual numbers from the report in your analysis. Respond with only valid JSON, no other text or markdown.`;

    const anthropic = requireAnthropic();
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const rawText = completion.content?.find((b) => b.type === 'text')?.text?.trim() || '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
    const aiResponse = JSON.parse(jsonStr);

    // Structure the response
    return {
      success: true,
      analysis: {
        keyFindings: aiResponse.keyFindings || [],
        performanceAnalysis: aiResponse.performanceAnalysis || '',
        recommendations: aiResponse.recommendations || [],
        riskAssessment: aiResponse.riskAssessment || [],
        growthOpportunities: aiResponse.growthOpportunities || [],
        strategicSuggestions: aiResponse.strategicSuggestions || []
      }
    };
  } catch (error) {
    console.error('Error in AI report analysis:', error);
    throw error;
  }
};

/**
 * Generate executive summary for report
 * @param {Object} reportData - The report data
 * @param {Object} options - Additional options
 * @returns {Promise<String>} Executive summary text
 */
const generateExecutiveSummary = async (reportData, options = {}) => {
  try {
    const { businessType = 'printing_press', period = 'monthly', startDate, endDate } = options;

    const prompt = `Generate a concise executive summary (2-3 paragraphs) for a ${businessType} business report covering ${startDate} to ${endDate}.

Key metrics:
- Revenue: GHS ${(reportData.revenue || 0).toLocaleString()}
- Expenses: GHS ${(reportData.expenses || 0).toLocaleString()}
- Profit: GHS ${((reportData.revenue || 0) - (reportData.expenses || 0)).toLocaleString()}
- Profit Margin: ${(reportData.profitMargin || 0).toFixed(2)}%
- Revenue Change: ${(reportData.revenueChange || 0) >= 0 ? '+' : ''}${(reportData.revenueChange || 0).toFixed(2)}%

Write in a professional, executive-friendly tone. Highlight key achievements, challenges, and strategic priorities.`;

    const anthropic = requireAnthropic();
    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    const textBlock = completion.content?.find((b) => b.type === 'text');
    return textBlock?.text?.trim() || '';
  } catch (error) {
    console.error('Error generating executive summary:', error);
    throw error;
  }
};

/**
 * Chat with the AI assistant using conversation history and tenant context.
 * Used for in-app Q&A (e.g. "How many customers this month?", "Predict next month sales").
 * @param {Array<{ role: string, content: string }>} messages - Conversation history (user/assistant)
 * @param {Object} context - Tenant context from getAssistantContext: { businessType, tenantName, workspaceContact, thisMonth, last3Months, receivables }
 * @param {Object} options - Optional { businessType }
 * @returns {Promise<string>} Assistant reply text
 */
const chatWithContext = async (messages, context, options = {}) => {
  try {
    const businessType = options.businessType || context.businessType || 'printing_press';
    const workspaceContact = context.workspaceContact || {};
    const contextBlob = JSON.stringify(
      {
        businessType,
        tenantName: context.tenantName,
        workspaceContact,
        thisMonth: context.thisMonth,
        last3Months: context.last3Months,
        receivables: context.receivables
      },
      null,
      2
    );

    const systemPrompt = `You are a helpful business assistant for a ${businessType} business using the African Business Suite (ABS) app. The user can ask questions about their business data (customers, revenue, expenses, sales), ask for predictions or summaries, ask how to use the app, or ask you to draft customer-facing emails or messages.

Current business data (use only this data for factual answers; currency is GHS):
${contextBlob}

Workspace contact (use for email signatures and drafts when values are non-null; never invent phone numbers or emails):
- businessName, email, phone, website appear under workspaceContact. If email or phone is null, do not use bracket placeholders like [Your phone] in the final message—instead add one short line telling the user to add missing details in Workspace / organization settings before sending.

App features (for "how do I" questions): Dashboard, Customers, Jobs (studio-type businesses), Quotes, Invoices, Sales, Expenses, Products, Materials, Vendors, Reports, Marketing, Settings. Users can create quotes (Quotes → Create Quote), record invoice payments (Invoices → open invoice → Record Payment), add expenses (Expenses → Add expense), create jobs (Jobs → Create Job), run POS/sales (Sales or POS). To email or SMS customers in bulk (promotions, announcements), use Marketing: choose channels, enter subject and plain-text message, respect consent and local rules—do not tell users to export CSV and use an external mail client unless they explicitly want that.

Rules:
- Answer factual questions (e.g. "How many customers this month?") using only the data above. Be concise and cite numbers.
- When the user asks how to do something in the app (e.g. "How do I create an expense?", "How do I create a quote?", "How do I record a payment?"), give clear step-by-step instructions. Mention the relevant page or menu (e.g. "Go to Expenses", "Open the invoice and click Record Payment"). Use a short numbered list. Keep it concise and actionable.
- Use clear formatting: put the main number in a short first line, then use a bullet list for details. Use **bold** for key numbers and labels.
- For predictions, use the trends in the data and clearly state: "This is an estimate, not a guarantee."
- For summaries, highlight key numbers and one or two actionable points.
- For financial summaries/analysis, always assess receivables risk from context.receivables. If receivables.totalOutstanding is material vs thisMonth.revenue (especially when outstanding >= 30% of thisMonth.revenue, or thisMonth.revenue is low and outstanding is high), explicitly call out outstanding risk and recommend collection actions.
- Customer-facing email drafts (promotions, newsletters, announcements): Output plain text suitable for ABS Marketing → Email (no HTML). Format exactly: first line \`Subject: ...\`, then a blank line, then the body only. Open with a friendly line (prefer "Hi there," unless the user asked for "Dear Customer" style). Include a clear single call to action (e.g. reply, call, visit). Add offers as short bullets if appropriate. Include offer end date if the user gave one; if not, omit or ask one clarifying question at the end instead of inventing a date. Add one brief line for terms if promotions are described (e.g. "Cannot be combined with other offers" only when relevant). Sign off with the business name from workspaceContact.businessName or tenantName. Use workspaceContact.phone and workspaceContact.email in the signature when present; otherwise one line: remind them to add phone/email in workspace settings. Avoid decorative emoji in professional B2B copy unless the user requests a casual tone.
- Keep replies concise. Do not make up data not present in the context.`;

    const anthropic = requireAnthropic();
    const claudeMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1536,
      system: systemPrompt,
      messages: claudeMessages
    });
    const textBlock = claudeResponse.content?.find((b) => b.type === 'text');
    return textBlock?.text?.trim() || 'I couldn\'t generate a response. Please try again.';
  } catch (error) {
    console.error('Error in chatWithContext:', error);
    throw error;
  }
};

module.exports = {
  analyzeReportData,
  generateExecutiveSummary,
  chatWithContext
};
