const {
  discoverReviewTypeEnumTypes,
  ensureEnumHasServiceValue,
  KNOWN_REVIEW_TYPE_ENUMS,
} = require('../../../migrations/extend-storefront-reviews-for-services');

describe('extend-storefront-reviews-for-services migration helpers', () => {
  describe('discoverReviewTypeEnumTypes', () => {
    it('merges information_schema results with known fallback enum names', async () => {
      const db = {
        query: jest.fn().mockResolvedValue([
          [{ typname: 'enum_storefront_reviews_review_type' }],
        ]),
      };

      const types = await discoverReviewTypeEnumTypes(db);

      expect(types).toEqual(['enum_storefront_reviews_review_type']);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('information_schema.columns'));
    });

    it('returns known fallbacks when column metadata is missing', async () => {
      const db = { query: jest.fn().mockResolvedValue([[]]) };

      const types = await discoverReviewTypeEnumTypes(db);

      expect(types).toEqual(KNOWN_REVIEW_TYPE_ENUMS);
    });
  });

  describe('ensureEnumHasServiceValue', () => {
    it('skips ALTER TYPE when enum type does not exist', async () => {
      const db = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[null]])
          .mockResolvedValueOnce([[{ ok: 1 }]]),
      };

      const result = await ensureEnumHasServiceValue(db, 'enum_storefront_reviews_reviewType');

      expect(result).toBe('missing');
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.query.mock.calls[0][0]).toContain('pg_type');
      expect(db.query.mock.calls[0][0]).not.toContain('::regtype');
    });

    it('skips ALTER TYPE when service value already exists', async () => {
      const db = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[{ oid: 12345 }]])
          .mockResolvedValueOnce([[{ ok: 1 }]]),
      };

      const result = await ensureEnumHasServiceValue(db, 'enum_storefront_reviews_review_type');

      expect(result).toBe('exists');
      expect(db.query).toHaveBeenCalledTimes(2);
      expect(db.query.mock.calls[1][0]).toContain('pg_enum');
      expect(db.query.mock.calls[1][0]).toContain('enumtypid = :oid');
    });

    it('adds service value when type exists and value is missing', async () => {
      const db = {
        query: jest
          .fn()
          .mockResolvedValueOnce([[{ oid: 12345 }]])
          .mockResolvedValueOnce([[]])
          .mockResolvedValueOnce([]),
      };

      const result = await ensureEnumHasServiceValue(db, 'enum_storefront_reviews_review_type');

      expect(result).toBe('added');
      expect(db.query).toHaveBeenCalledTimes(3);
      expect(db.query.mock.calls[2][0]).toBe(
        `ALTER TYPE "enum_storefront_reviews_review_type" ADD VALUE 'service'`
      );
    });
  });
});
