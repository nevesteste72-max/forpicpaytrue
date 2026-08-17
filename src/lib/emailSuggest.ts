/**
 * Suggests a corrected email when the typed domain is a near-miss of a common
 * one ("gmial.com", "hotmai.com", "gmail.con") or an unfinished prefix of it
 * ("julio@gm").
 *
 * The suggestion is only ever SHOWN to the person — it is never applied on its
 * own. A wrong guess would mean mailing a real stranger, which costs far more
 * (spam complaints on the same domain that sends the purchase emails) than a
 * lost recovery.
 */

// Ordered by how common they are here, so an ambiguous prefix resolves to the
// likeliest domain.
const DOMAINS = [
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "live.com.pt",
  "sapo.pt",
  "yahoo.com",
  "icloud.com",
  "outlook.pt",
  "hotmail.fr",
  "gmail.pt",
  "msn.com",
];

/**
 * Damerau-Levenshtein distance, capped early — we only care about tiny
 * distances. Transposition counts as ONE edit because swapped letters are the
 * single most common way a domain gets mistyped ("gmial" for "gmail").
 */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, i) => i)];
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(cur[j - 1] + 1, rows[i - 1][j] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, rows[i - 2][j - 2] + 1);
      }
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    rows.push(cur);
  }
  return rows[a.length][b.length];
}

export function suggestEmail(raw: string): string | null {
  const value = (raw || "").trim().toLowerCase();
  const at = value.indexOf("@");
  if (at <= 0) return null;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  // Nothing typed after the "@" is not a typo, it is an unanswered question.
  // Guessing here would be wrong about half the time.
  if (!domain) return null;
  if (DOMAINS.includes(domain)) return null;

  // Unfinished but unambiguous: "gm" only reads as gmail.com among these.
  const prefixHits = DOMAINS.filter((d) => d.startsWith(domain));
  if (prefixHits.length > 0 && domain.length >= 2) {
    return `${local}@${prefixHits[0]}`;
  }

  // Typo: allow one edit for short domains, two for longer ones.
  let best: string | null = null;
  let bestDist = Infinity;
  for (const candidate of DOMAINS) {
    const max = candidate.length > 10 ? 2 : 1;
    const d = distance(domain, candidate, max);
    if (d <= max && d < bestDist) {
      best = candidate;
      bestDist = d;
    }
  }
  return best ? `${local}@${best}` : null;
}
