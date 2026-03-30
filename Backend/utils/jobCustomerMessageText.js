/**
 * Builds a single line for customer notifications (WhatsApp templates, etc.).
 * Many jobs store a short category label in `title` (e.g. "Logo") while the
 * human-readable detail lives in `description` or the first line item.
 *
 * @param {{ title?: string, description?: string|null, items?: Array<{ description?: string }>|null }} job
 * @param {number} [maxLen] - Cap length for template body variables
 * @returns {string}
 */
function buildCustomerFacingJobTitle(job, maxLen = 1024) {
  const title = (job?.title && String(job.title).trim()) || 'Job';
  const desc = job?.description && String(job.description).trim();
  const items = Array.isArray(job?.items) ? job.items : [];
  const firstItemDesc = items[0]?.description && String(items[0].description).trim();

  const redundant = (base, extra) => {
    if (!extra || extra === base) return true;
    const probe = extra.slice(0, Math.min(48, extra.length)).toLowerCase();
    return base.toLowerCase().includes(probe);
  };

  let out = title;
  if (desc && !redundant(title, desc)) {
    out = `${title} — ${desc}`;
  } else if (firstItemDesc && !redundant(title, firstItemDesc)) {
    out = `${title} — ${firstItemDesc}`;
  }

  if (out.length > maxLen) {
    out = `${out.slice(0, Math.max(0, maxLen - 1))}…`;
  }
  return out;
}

module.exports = { buildCustomerFacingJobTitle };
