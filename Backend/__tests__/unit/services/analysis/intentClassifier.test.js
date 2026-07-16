const { classifyIntent, isAnalysisIntent } = require('../../../../services/analysis/intentClassifier');

describe('intentClassifier', () => {
  it('classifies sales today', () => {
    const r = classifyIntent("How much did I sell today?");
    expect(r.route).toBe('analysis');
    expect(r.intent).toBe('sales_today');
    expect(isAnalysisIntent(r.intent)).toBe(true);
  });

  it('classifies sales this month', () => {
    const r = classifyIntent('How are sales this month?');
    expect(r.intent).toBe('sales_this_month');
    expect(r.route).toBe('analysis');
  });

  it('classifies compare vs prior period', () => {
    const r = classifyIntent('Compare this period to the previous period');
    expect(r.intent).toBe('sales_vs_prior_period');
  });

  it('classifies why sales down before generic sales', () => {
    const r = classifyIntent('Why are sales down?');
    expect(r.intent).toBe('why_sales_down');
  });

  it('classifies top products', () => {
    expect(classifyIntent('What are my top products?').intent).toBe('top_products');
  });

  it('classifies who owes me', () => {
    expect(classifyIntent('Who owes me money?').intent).toBe('who_owes_me');
  });

  it('classifies low stock / restock', () => {
    expect(classifyIntent('What should I restock?').intent).toBe('low_stock');
  });

  it('classifies performance summary', () => {
    expect(classifyIntent('Summarize performance').intent).toBe('performance_summary');
  });

  it('routes how-to to support', () => {
    const r = classifyIntent('How do I create an invoice?');
    expect(r.route).toBe('support');
  });

  it('routes draft requests to draft', () => {
    const r = classifyIntent('Draft a polite payment reminder for overdue customers');
    expect(r.route).toBe('draft');
  });

  it('returns unsupported with suggestions for greetings', () => {
    const r = classifyIntent('hello');
    expect(r.route).toBe('unsupported');
    expect(r.suggestedQuestions?.length).toBeGreaterThan(0);
  });
});
