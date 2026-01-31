let _openai = null;

/** Lazy-init OpenAI client; null if OPENAI_API_KEY is not set. Never requires openai until key exists. */
function getOpenAI() {
  if (_openai !== null) return _openai;
  let key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  // Remove any newlines/carriage returns (e.g. from .env line wrap or copy-paste)
  key = key.replace(/\r?\n/g, '');
  if (!key) return null;
  const { OpenAI } = require('openai');
  _openai = new OpenAI({ apiKey: key });
  return _openai;
}

function requireOpenAI() {
  const client = getOpenAI();
  if (!client) {
    const err = new Error('OpenAI API key not configured. Set OPENAI_API_KEY in .env to use AI features.');
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
const analyzeReportData = async (reportData, options = {}) => {
  try {
    const {
      businessType = 'printing_press',
      period = 'monthly',
      startDate,
      endDate
    } = options;

    // Map business type to terminology
    const businessTerminology = {
      printing_press: {
        items: 'services',
        sales: 'jobs',
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

    const terms = businessTerminology[businessType] || businessTerminology.printing_press;

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
      businessType,
      topItems: reportData.topItems || [],
      expenseBreakdown: reportData.expenseBreakdown || [],
      inventory: reportData.inventory || null,
      outstandingPayments: reportData.outstandingPayments || 0
    };

    // Create comprehensive prompt for AI analysis
    const systemPrompt = `You are an expert business analyst specializing in ${businessType} operations. Analyze the provided business data and generate actionable insights, recommendations, and strategic suggestions. Be specific, data-driven, and practical.`;

    const userPrompt = `Analyze the following business report data for a ${businessType} business and provide:

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

${dataSummary.inventory ? `Inventory Status: ${dataSummary.inventory.totalStocks} total items, ${dataSummary.inventory.stockAvailabilityRate}% availability rate` : ''}

Provide your analysis in a structured JSON format with the following keys:
- keyFindings: array of strings
- performanceAnalysis: string (detailed paragraph)
- recommendations: array of objects with {priority: "High|Medium|Low", action: string, impact: string, reasoning: string}
- riskAssessment: array of objects with {risk: string, severity: "High|Medium|Low", mitigation: string}
- growthOpportunities: array of objects with {opportunity: string, potentialImpact: string, actionSteps: string[]}
- strategicSuggestions: array of strings

Be specific, actionable, and data-driven. Use the actual numbers from the report in your analysis.`;

    const openai = requireOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    });

    // Parse the AI response
    const aiResponse = JSON.parse(completion.choices[0].message.content);

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
    console.error('Error in OpenAI analysis:', error);
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

    const openai = requireOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error generating executive summary:', error);
    throw error;
  }
};

/**
 * Chat with the AI assistant using conversation history and tenant context.
 * Used for in-app Q&A (e.g. "How many customers this month?", "Predict next month sales").
 * @param {Array<{ role: string, content: string }>} messages - Conversation history (user/assistant)
 * @param {Object} context - Tenant context from getAssistantContext: { businessType, tenantName, thisMonth, last3Months }
 * @param {Object} options - Optional { businessType }
 * @returns {Promise<string>} Assistant reply text
 */
const chatWithContext = async (messages, context, options = {}) => {
  try {
    const businessType = options.businessType || context.businessType || 'printing_press';
    const contextBlob = JSON.stringify(
      {
        businessType,
        tenantName: context.tenantName,
        thisMonth: context.thisMonth,
        last3Months: context.last3Months
      },
      null,
      2
    );

    const systemPrompt = `You are a helpful business assistant for a ${businessType} business. The user can ask questions about their business data (customers, revenue, expenses, sales) or ask for predictions or summaries.

Current business data (use only this data for factual answers; currency is GHS):
${contextBlob}

Rules:
- Answer factual questions (e.g. "How many customers this month?") using only the data above. Be concise and cite numbers.
- For predictions (e.g. "Predict next month sales"), use the trends in the data and clearly state: "This is an estimate, not a guarantee."
- For summaries, highlight key numbers and one or two actionable points.
- Keep replies concise (a short paragraph or bullet points). Do not make up data not present in the context.`;

    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content }))
    ];

    const openai = requireOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: apiMessages,
      temperature: 0.5,
      max_tokens: 1024
    });

    const reply = completion.choices[0]?.message?.content?.trim() || 'I couldn\'t generate a response. Please try again.';
    return reply;
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
