import type { Recipient } from '../api/types';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
export const isValidEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());

const splitCsvLine = (line: string) =>
  line.split(/,|;|\t/).map((c) => c.trim().replace(/^"|"$/g, '').trim());

/**
 * Parses an uploaded CSV / text file into recipients.
 * - CSV with a header row containing "email" (and optionally "name" / "first name" / "last name")
 *   -> uses those columns.
 * - Anything else -> extracts every email-looking token.
 * Duplicates (case-insensitive) are removed.
 */
export function parseLeads(text: string): Recipient[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const out: Recipient[] = [];

  const header = lines[0] ? splitCsvLine(lines[0]).map((h) => h.toLowerCase()) : [];
  const emailCol = header.findIndex((h) => h === 'email' || h === 'e-mail' || h === 'email address');

  if (emailCol >= 0) {
    const nameCol = header.findIndex((h) => h === 'name' || h === 'full name');
    const firstCol = header.findIndex((h) => h === 'first name' || h === 'first_name' || h === 'firstname');
    const lastCol = header.findIndex((h) => h === 'last name' || h === 'last_name' || h === 'lastname');
    for (const line of lines.slice(1)) {
      const cells = splitCsvLine(line);
      const email = cells[emailCol];
      if (!email || !isValidEmail(email)) continue;
      const name =
        (nameCol >= 0 && cells[nameCol]) ||
        [firstCol >= 0 ? cells[firstCol] : '', lastCol >= 0 ? cells[lastCol] : ''].join(' ').trim() ||
        null;
      out.push({ email, name });
    }
  } else {
    for (const m of text.matchAll(EMAIL_RE)) out.push({ email: m[0] });
  }

  return dedupeRecipients(out);
}

export function dedupeRecipients(list: Recipient[]): Recipient[] {
  const seen = new Set<string>();
  return list.filter((r) => {
    const key = r.email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
