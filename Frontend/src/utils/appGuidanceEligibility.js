import { APP_GUIDANCE } from '../constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {string|Date|number|null|undefined} value
 * @returns {Date|null}
 */
export function parseGuidanceDate(value) {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * @param {Date} date
 * @returns {number}
 */
export function daysSinceDate(date) {
  return (Date.now() - date.getTime()) / MS_PER_DAY;
}

/**
 * Earliest known date for when the user joined this workspace / platform.
 * @param {{ user?: object, activeMembership?: object, activeTenant?: object }} params
 * @returns {Date|null}
 */
export function getAccountStartDate({ user, activeMembership, activeTenant }) {
  const candidates = [
    parseGuidanceDate(user?.createdAt),
    parseGuidanceDate(activeMembership?.joinedAt),
    parseGuidanceDate(activeMembership?.createdAt),
    parseGuidanceDate(activeTenant?.createdAt),
  ].filter(Boolean);

  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

/**
 * True when the user has been on the account long enough that we should not
 * auto-show product tours or force workspace onboarding again.
 *
 * @param {{ user?: object, activeMembership?: object, activeTenant?: object }} params
 * @returns {boolean}
 */
export function shouldSuppressAppGuidance({ user, activeMembership, activeTenant }) {
  if (!user) return false;

  const accountStart = getAccountStartDate({ user, activeMembership, activeTenant });
  const accountAgeDays = accountStart ? daysSinceDate(accountStart) : null;

  if (accountAgeDays != null && accountAgeDays >= APP_GUIDANCE.TENURE_DAYS) {
    return true;
  }

  const lastLogin = parseGuidanceDate(user.lastLogin);
  if (
    lastLogin &&
    user.isFirstLogin === false &&
    accountAgeDays != null &&
    accountAgeDays >= APP_GUIDANCE.MIN_ACCOUNT_AGE_DAYS_FOR_ACTIVE &&
    daysSinceDate(lastLogin) <= APP_GUIDANCE.ACTIVE_RECENT_LOGIN_DAYS
  ) {
    return true;
  }

  return false;
}
