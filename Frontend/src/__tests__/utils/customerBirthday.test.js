import {
  BIRTHDAY_STORAGE_YEAR,
  daysInMonth,
  formatBirthdayDisplay,
  parseBirthdayParts,
  toBirthdayStorageDate,
} from '../../utils/customerBirthday';

describe('customerBirthday utils', () => {
  it('builds fixed-year storage date from month and day', () => {
    expect(toBirthdayStorageDate('7', '11')).toBe(`${BIRTHDAY_STORAGE_YEAR}-07-11`);
    expect(toBirthdayStorageDate('', '11')).toBe('');
    expect(toBirthdayStorageDate('2', '30')).toBe('');
  });

  it('parses legacy full DOB into month/day selects', () => {
    expect(parseBirthdayParts('1985-12-25')).toEqual({ month: '12', day: '25' });
    expect(parseBirthdayParts(`${BIRTHDAY_STORAGE_YEAR}-03-01`)).toEqual({ month: '3', day: '1' });
  });

  it('formats display without year', () => {
    expect(formatBirthdayDisplay('1990-07-15')).toMatch(/Jul/);
    expect(formatBirthdayDisplay('1990-07-15')).toMatch(/15/);
    expect(formatBirthdayDisplay(null)).toBe('');
  });

  it('allows Feb 29 for leap storage year', () => {
    expect(daysInMonth(2)).toBe(29);
    expect(toBirthdayStorageDate('2', '29')).toBe(`${BIRTHDAY_STORAGE_YEAR}-02-29`);
  });
});
