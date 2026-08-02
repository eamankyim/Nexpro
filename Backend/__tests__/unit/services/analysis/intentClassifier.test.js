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

  it('classifies what to work on based on sales as performance summary', () => {
    const r = classifyIntent(
      'What do I need to work on in my business based on this yearr sales'
    );
    expect(r.route).toBe('analysis');
    expect(r.intent).toBe('performance_summary');
  });

  it('classifies this quarter sales via selected-period analysis', () => {
    const r = classifyIntent('How much did I sell this quarter?');
    expect(r.route).toBe('analysis');
    expect(r.intent).toBe('sales_this_month');
  });

  it('routes how-to to support', () => {
    const r = classifyIntent('How do I create an invoice?');
    expect(r.route).toBe('support');
  });

  it('routes draft requests to draft', () => {
    const r = classifyIntent('Draft a polite payment reminder for overdue customers');
    expect(r.route).toBe('draft');
  });

  it('routes growth advice to advisory', () => {
    const r = classifyIntent('How do I get more customers?');
    expect(r.route).toBe('advisory');
    expect(r.intent).toBe('business_advisory');
  });

  it('routes marketing strategy to advisory', () => {
    expect(classifyIntent('Give me marketing tips for my shop').route).toBe('advisory');
  });

  it('routes predictions to advisory', () => {
    const r = classifyIntent('Will I sell more next week?');
    expect(r.route).toBe('advisory');
    expect(r.suggestedQuestions?.length).toBeGreaterThan(0);
  });

  it('routes unknown open questions to advisory with suggestions', () => {
    const r = classifyIntent('What is the meaning of inventory turnover for a boutique?');
    expect(r.route).toBe('advisory');
    expect(r.suggestedQuestions?.length).toBeGreaterThan(0);
  });

  it('keeps empty message unsupported', () => {
    const r = classifyIntent('   ');
    expect(r.route).toBe('unsupported');
  });

  it('routes bare greetings to advisory (chat uses smallTalk separately)', () => {
    const r = classifyIntent('hello');
    expect(r.route).toBe('advisory');
    expect(r.suggestedQuestions?.length).toBeGreaterThan(0);
  });
});
