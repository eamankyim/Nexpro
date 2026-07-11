const {
  BIRTHDAY_STORAGE_YEAR,
  daysInMonth,
  parseBirthdayParts,
  normalizeBirthdayDate,
  toMonthDayString,
  matchBirthdayMonthDay,
} = require('../../../utils/customerBirthday');

describe('customerBirthday utils', () => {
  describe('normalizeBirthdayDate', () => {
    it('stores day+month with fixed year 2000', () => {
      expect(normalizeBirthdayDate('1990-07-15')).toBe(`${BIRTHDAY_STORAGE_YEAR}-07-15`);
      expect(normalizeBirthdayDate('07-15')).toBe(`${BIRTHDAY_STORAGE_YEAR}-07-15`);
      expect(normalizeBirthdayDate('2000-03-01')).toBe(`${BIRTHDAY_STORAGE_YEAR}-03-01`);
    });

    it('returns null for empty or invalid values', () => {
      expect(normalizeBirthdayDate(null)).toBeNull();
      expect(normalizeBirthdayDate('')).toBeNull();
      expect(normalizeBirthdayDate('not-a-date')).toBeNull();
      expect(normalizeBirthdayDate('2020-02-30')).toBeNull();
    });

    it('allows Feb 29 because storage year is a leap year', () => {
      expect(normalizeBirthdayDate('1992-02-29')).toBe(`${BIRTHDAY_STORAGE_YEAR}-02-29`);
      expect(daysInMonth(2)).toBe(29);
    });
  });

  describe('parseBirthdayParts / toMonthDayString', () => {
    it('parses full DOB and MM-DD ignoring year', () => {
      expect(parseBirthdayParts('1985-12-25')).toEqual({ month: 12, day: 25 });
      expect(toMonthDayString('1985-12-25')).toBe('12-25');
      expect(toMonthDayString('12-25')).toBe('12-25');
    });
  });

  describe('matchBirthdayMonthDay', () => {
    it('matches today on month and day regardless of birth year', () => {
      const now = new Date(2026, 6, 11); // Jul 11 local
      expect(matchBirthdayMonthDay('1999-07-11', now)).toEqual({ sameMonth: true, sameDay: true });
      expect(matchBirthdayMonthDay('2000-07-11', now)).toEqual({ sameMonth: true, sameDay: true });
      expect(matchBirthdayMonthDay('07-11', now)).toEqual({ sameMonth: true, sameDay: true });
    });

    it('matches this_month when day differs', () => {
      const now = new Date(2026, 6, 11);
      expect(matchBirthdayMonthDay('2010-07-01', now)).toEqual({ sameMonth: true, sameDay: false });
      expect(matchBirthdayMonthDay('2010-08-11', now)).toEqual({ sameMonth: false, sameDay: true });
    });

    it('does not match missing birthday', () => {
      expect(matchBirthdayMonthDay(null, new Date())).toEqual({ sameMonth: false, sameDay: false });
    });
  });
});
