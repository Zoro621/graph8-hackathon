// Removes personal data before anything is written to a committed fixture or a log.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g;
const SAFE_EMAIL = /@example\.(com|org|net)$/i;

export function scrubText(s: string): string {
  return s.replace(EMAIL, (m) => (SAFE_EMAIL.test(m) ? m : "redacted@example.com")).replace(PHONE, "[phone]");
}

/** Deep-scrub every string in a JSON-like value. */
export function scrub<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map(scrub) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v)])) as T;
  }
  return value;
}
