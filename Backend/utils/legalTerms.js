const TERMS_VERSION = '2026-05';
const TERMS_LABEL = 'ABS Terms and Conditions';
const TERMS_ACCEPTANCE_REQUIRED_MESSAGE =
  'You must accept the ABS Terms and Conditions and Privacy Policy to continue.';

const isTermsAccepted = (value) => value === true || value === 'true' || value === 'on' || value === '1';

const buildTermsAcceptanceMetadata = (req, options = {}) => {
  const acceptedAt = new Date().toISOString();
  return {
    accepted: true,
    acceptedAt,
    termsVersion: options.termsVersion || TERMS_VERSION,
    label: TERMS_LABEL,
    source: options.source || 'unknown',
    ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    userAgent: req.get ? req.get('user-agent') || null : req.headers?.['user-agent'] || null,
  };
};

module.exports = {
  TERMS_VERSION,
  TERMS_LABEL,
  TERMS_ACCEPTANCE_REQUIRED_MESSAGE,
  isTermsAccepted,
  buildTermsAcceptanceMetadata,
};
