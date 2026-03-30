/**
 * Form utilities for number inputs that allow clearing (empty string) before entering a value.
 * Use with value={numberInputValue(field.value)} and onChange={(e) => handleNumberChange(e, field.onChange)}.
 */

/**
 * Use as Input value so 0 and '' both display correctly; empty string shows as clear field.
 * @param {number|string} v - Form field value
 * @returns {number|string} - Value to pass to input ('' when v is '')
 */
export const numberInputValue = (v) => (v === '' ? '' : v);

/**
 * Use as Input onChange so user can clear the field; empty string is stored, invalid input stored as ''.
 * @param {React.ChangeEvent<HTMLInputElement>} e - Change event
 * @param {function} onChange - Form field onChange (e.g. field.onChange)
 */
export const handleNumberChange = (e, onChange) => {
  const raw = e.target.value;
  if (raw === '') {
    onChange('');
    return;
  }
  const n = parseFloat(raw);
  onChange(Number.isNaN(n) ? '' : n);
};

/**
 * Zod schema helper: accept number or empty string, transform '' to 0 on submit.
 * Use for required number fields (e.g. costPrice, quantityOnHand).
 */
export const numberOrEmptySchema = (z) =>
  z.union([z.number().min(0), z.literal('')]).transform((v) => (v === '' ? 0 : v));

/**
 * Zod schema helper: accept number or empty string, transform '' to undefined.
 * Use for optional number fields.
 */
export const optionalNumberOrEmptySchema = (z) =>
  z.union([z.number(), z.literal('')]).transform((v) => (v === '' ? undefined : v)).optional();

/**
 * Use as Input onChange for integer fields so user can clear the field.
 * @param {React.ChangeEvent<HTMLInputElement>} e - Change event
 * @param {function} onChange - Form field onChange
 */
export const handleIntegerChange = (e, onChange) => {
  const raw = e.target.value;
  if (raw === '') {
    onChange('');
    return;
  }
  const n = parseInt(raw, 10);
  onChange(Number.isNaN(n) ? '' : n);
};

/**
 * Zod schema helper: accept integer or empty string, transform '' to defaultVal on submit.
 * @param {object} z - Zod
 * @param {number} defaultVal - Value when input is '' (e.g. 0 or 1)
 */
export const integerOrEmptySchema = (z, defaultVal = 0) =>
  z.union([z.number().int(), z.literal('')]).transform((v) => (v === '' ? defaultVal : v));
