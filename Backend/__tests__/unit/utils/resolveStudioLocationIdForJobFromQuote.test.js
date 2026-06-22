const { resolveStudioLocationIdForJobFromQuote } = require('../../../utils/studioLocationUtils');

describe('resolveStudioLocationIdForJobFromQuote', () => {
  it('prefers active studio location from request scope', () => {
    const locationId = resolveStudioLocationIdForJobFromQuote(
      {
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-b',
      },
      { studioLocationId: 'studio-a' }
    );

    expect(locationId).toBe('studio-b');
  });

  it('falls back to quote studio location when request is not scoped', () => {
    const locationId = resolveStudioLocationIdForJobFromQuote(
      { studioLocationScoped: false },
      { studioLocationId: 'studio-a' }
    );

    expect(locationId).toBe('studio-a');
  });

  it('falls back to quote studio location for internal conversion without request', () => {
    const locationId = resolveStudioLocationIdForJobFromQuote(null, {
      studioLocationId: 'studio-a',
    });

    expect(locationId).toBe('studio-a');
  });

  it('returns null when neither request scope nor quote has a location', () => {
    const locationId = resolveStudioLocationIdForJobFromQuote(
      { studioLocationScoped: false },
      { studioLocationId: null }
    );

    expect(locationId).toBeNull();
  });
});
