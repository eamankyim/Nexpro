/**
 * Future ABS public API client for Sabito App marketplace.
 * v1 uses `lib/mock-data.ts`. Wire NEXT_PUBLIC_ABS_API_URL when the
 * backend exposes partner-program listings.
 */

const ABS_API_URL = (process.env.NEXT_PUBLIC_ABS_API_URL || "").replace(
  /\/$/,
  ""
);

/**
 * Planned ABS endpoint (not implemented yet):
 * GET /api/public/sabito-partners
 * Returns tenants with partnerProgramEnabled === true.
 */
export async function fetchPartnerBusinesses() {
  if (!ABS_API_URL) {
    return null;
  }
  try {
    const res = await fetch(`${ABS_API_URL}/api/public/sabito-partners`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
