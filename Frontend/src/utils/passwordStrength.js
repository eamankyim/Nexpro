/**
 * Calculate password strength and return strength level and feedback
 * @param {string} password - The password to check
 * @returns {object} - { strength: 'weak'|'medium'|'strong', score: number, feedback: string }
 */
export const calculatePasswordStrength = (password) => {
  if (!password || password.length === 0) {
    return { strength: 'weak', score: 0, feedback: '' };
  }

  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };

  // Calculate score
  if (checks.length) score += 1;
  if (checks.lowercase) score += 1;
  if (checks.uppercase) score += 1;
  if (checks.number) score += 1;
  if (checks.special) score += 1;
  if (password.length >= 12) score += 1;

  // Determine strength
  let strength = 'weak';
  let feedback = 'Password strength: weak';

  if (score >= 5) {
    strength = 'strong';
    feedback = 'Password strength: strong';
  } else if (score >= 3) {
    strength = 'medium';
    feedback = 'Password strength: medium';
  }

  return { strength, score, feedback, checks };
};
