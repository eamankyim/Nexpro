const {
  attachServiceReviewSummaries,
} = require('../../../services/storefrontReviewService');

describe('storefrontReviewService service reviews', () => {
  it('returns services unchanged when no listing ids are provided', async () => {
    const services = [{ id: null, title: 'Test' }];
    const result = await attachServiceReviewSummaries(services);
    expect(result).toEqual(services);
  });

  it('attaches default review summary shape when services have ids but reviews table is unavailable', async () => {
    const services = [{ id: '00000000-0000-0000-0000-000000000001', title: 'Haircut' }];
    const result = await attachServiceReviewSummaries(services);
    expect(result[0].reviewsCount).toBeDefined();
    expect(result[0].reviewSummary).toBeDefined();
  });
});
