const TENURE_DAYS = 30;
const ACTIVE_RECENT_LOGIN_DAYS = 14;
const MIN_ACCOUNT_AGE_DAYS_FOR_ACTIVE = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseGuidanceDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSinceDate(date: Date): number {
  return (Date.now() - date.getTime()) / MS_PER_DAY;
}

function getAccountStartDate(params: {
  user?: { createdAt?: string } | null;
  activeMembership?: { joinedAt?: string; createdAt?: string } | null;
  activeTenant?: { createdAt?: string } | null;
}): Date | null {
  const candidates = [
    parseGuidanceDate(params.user?.createdAt),
    parseGuidanceDate(params.activeMembership?.joinedAt),
    parseGuidanceDate(params.activeMembership?.createdAt),
    parseGuidanceDate(params.activeTenant?.createdAt),
  ].filter((d): d is Date => d != null);

  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates.map((d) => d.getTime())));
}

export function shouldSuppressAppGuidance(params: {
  user?: { createdAt?: string; lastLogin?: string; isFirstLogin?: boolean } | null;
  activeMembership?: { joinedAt?: string; createdAt?: string } | null;
  activeTenant?: { createdAt?: string } | null;
}): boolean {
  const { user, activeMembership, activeTenant } = params;
  if (!user) return false;

  const accountStart = getAccountStartDate({ user, activeMembership, activeTenant });
  const accountAgeDays = accountStart ? daysSinceDate(accountStart) : null;

  if (accountAgeDays != null && accountAgeDays >= TENURE_DAYS) {
    return true;
  }

  const lastLogin = parseGuidanceDate(user.lastLogin);
  if (
    lastLogin &&
    user.isFirstLogin === false &&
    accountAgeDays != null &&
    accountAgeDays >= MIN_ACCOUNT_AGE_DAYS_FOR_ACTIVE &&
    daysSinceDate(lastLogin) <= ACTIVE_RECENT_LOGIN_DAYS
  ) {
    return true;
  }

  return false;
}
