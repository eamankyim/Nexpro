const {
  getJobItemCategories,
  resolveCategoryCatalogKey,
  resolveMaterialStudioType,
} = require('../../../config/jobItemCategories');

describe('jobItemCategories', () => {
  it('returns printing press services for printing_press studioType', () => {
    const cats = getJobItemCategories('studio', { studioType: 'printing_press' });
    expect(cats.some((c) => c.value === 'Business Cards')).toBe(true);
    expect(cats.some((c) => c.value === 'Services' && c.group === 'Services')).toBe(false);
  });

  it('returns software services when studioType is software_it_services', () => {
    const cats = getJobItemCategories('studio', { studioType: 'software_it_services' });
    expect(cats.some((c) => c.value === 'Frontend Development')).toBe(true);
    expect(cats.some((c) => c.value === 'Website Hosting')).toBe(true);
  });

  it('returns software services when only businessSubType is set', () => {
    const cats = getJobItemCategories('studio', { businessSubType: 'software_it_services' });
    expect(resolveCategoryCatalogKey('studio', { businessSubType: 'software_it_services' }))
      .toBe('software_it_services');
    expect(cats.some((c) => c.value === 'Mobile App Development')).toBe(true);
  });

  it('maps modern subtype ids to legacy catalogs', () => {
    expect(resolveCategoryCatalogKey('studio', { studioType: 'barber_shop' })).toBe('barber');
    expect(resolveCategoryCatalogKey('studio', { studioType: 'hair_salon' })).toBe('salon');
    expect(resolveCategoryCatalogKey('studio', { studioType: 'mechanic_workshop' })).toBe('mechanic');
    expect(resolveCategoryCatalogKey('studio', { studioType: 'spa_nail_bar' })).toBe('salon');
    expect(resolveCategoryCatalogKey('studio', { studioType: 'car_wash' })).toBe('car_wash');
  });

  it('prefers location studioType over tenant businessSubType', () => {
    const cats = getJobItemCategories('studio', {
      studioType: 'software_it_services',
      businessSubType: 'printing_press',
    });
    expect(cats.some((c) => c.value === 'Frontend Development')).toBe(true);
    expect(cats.some((c) => c.value === 'Business Cards')).toBe(false);
  });

  it('does not return generic default for known studio subtypes', () => {
    const cats = getJobItemCategories('studio', { studioType: 'barber_shop' });
    expect(cats.some((c) => c.value === 'Haircuts')).toBe(true);
    expect(cats.some((c) => c.value === 'Services')).toBe(false);
    expect(cats.some((c) => c.value === 'Materials')).toBe(false);
    expect(cats.some((c) => c.value === 'Equipment')).toBe(false);
  });

  it('returns default only for unknown studio subtypes', () => {
    const cats = getJobItemCategories('studio', { studioType: 'unknown_type' });
    expect(cats.some((c) => c.value === 'Services')).toBe(true);
    expect(cats.some((c) => c.value === 'Materials')).toBe(true);
  });

  it('returns default for non-studio business types', () => {
    const cats = getJobItemCategories('shop', { studioType: 'printing_press' });
    expect(cats.some((c) => c.value === 'Services')).toBe(true);
  });

  it('resolves material studio type for modern subtypes', () => {
    expect(resolveMaterialStudioType('studio', { studioType: 'barber_shop' })).toBe('barber');
    expect(resolveMaterialStudioType('studio', { studioType: 'mechanic_workshop' })).toBe('mechanic');
  });
});
