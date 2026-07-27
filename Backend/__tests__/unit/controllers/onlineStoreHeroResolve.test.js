/**
 * Hero slide resolve must not drop slides that already have an imageUrl when
 * the library design/colorway is missing (classic prod vs local drift).
 */

const {
  normalizeAndResolveHeroSlides,
} = require('../../../controllers/onlineStoreHeroController');

describe('normalizeAndResolveHeroSlides', () => {
  it('keeps library slides with stored imageUrl when designMap is empty', () => {
    const resolved = normalizeAndResolveHeroSlides(
      [
        {
          type: 'library',
          designId: 'missing-design',
          colorwayId: 'missing-colorway',
          imageUrl: '/uploads/online-store-heroes/colorways/hero.jpg',
        },
      ],
      '#166534',
      new Map()
    );

    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      type: 'library',
      designId: 'missing-design',
      imageUrl: '/uploads/online-store-heroes/colorways/hero.jpg',
      sortOrder: 0,
    });
  });

  it('keeps upload slides with relative upload paths', () => {
    const resolved = normalizeAndResolveHeroSlides(
      [{ type: 'upload', imageUrl: '/uploads/online-store-heroes/tenant-uploads/t1/a.png' }],
      '#166534',
      new Map()
    );
    expect(resolved).toEqual([
      {
        type: 'upload',
        imageUrl: '/uploads/online-store-heroes/tenant-uploads/t1/a.png',
        sortOrder: 0,
      },
    ]);
  });

  it('does not truncate data URL uploads below a usable length', () => {
    const dataUrl = `data:image/png;base64,${'A'.repeat(5000)}`;
    const resolved = normalizeAndResolveHeroSlides(
      [{ type: 'upload', imageUrl: dataUrl }],
      '#166534',
      new Map()
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0].imageUrl).toBe(dataUrl);
  });
});
