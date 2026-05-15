/**
 * phone.ts  ─  Phone normalisation & validation (Egypt only)
 * ─────────────────────────────────────────────────────────────────────────────
 * Egypt:  +20  —  01[0125]XXXXXXXX  (11 local digits)
 *   Vodafone:   010
 *   Orange:     012
 *   Etisalat:   011
 *   WE (Telecom Egypt): 015
 * ─────────────────────────────────────────────────────────────────────────────
 */

const EGYPT_CODE   = '20';
const EGYPT_PREFIX = '+20';

/**
 * Normalise any Egyptian phone to E.164 format (+20XXXXXXXXXX).
 *
 * Accepts:
 *   +20XXXXXXXXXX   → unchanged
 *   0020XXXXXXXXXX  → +20XXXXXXXXXX
 *   0XXXXXXXXXX     → +20XXXXXXXXXX  (strip leading 0)
 *   01XXXXXXXXX     → +2001XXXXXXXXX
 */
export function normalizePhone(raw: string, _defaultCountryCode = '+20'): string {
  let p = raw.trim().replace(/[\s\-().+]/g, '');

  if (p.startsWith('0020')) p = p.substring(4);
  else if (p.startsWith('20')) p = p.substring(2);
  
  if (p.startsWith('0')) p = p.substring(1);

  return EGYPT_PREFIX + p;
}

/**
 * Validate an E.164 Egyptian mobile number.
 * Accepted prefixes: 10, 11, 12, 15 (after +20)
 */
export function validatePhone(e164: string): { valid: boolean; error?: string } {
  if (!e164.startsWith(EGYPT_PREFIX)) {
    return {
      valid: false,
      error: 'يجب أن يبدأ رقم الهاتف بـ +20 (مصر)',
    };
  }

  const local = e164.substring(EGYPT_PREFIX.length); // e.g. "1012345678"

  if (!/^1[0125]\d{8}$/.test(local)) {
    return {
      valid: false,
      error: 'رقم الهاتف المصري غير صحيح — يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015 ويتكون من 11 رقماً',
    };
  }

  return { valid: true };
}
