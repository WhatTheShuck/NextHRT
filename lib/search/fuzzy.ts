/**
 * Fuzzy matcher behind the command palette. No dependencies, and every match
 * carries character ranges so the UI can highlight what hit.
 *
 * A query is split on whitespace and every token has to match somewhere in the
 * item (AND), so "smith safety" finds Jo Smith in the Safety department. Per
 * token, the strongest of these wins:
 *   exact > prefix > word prefix > acronym ("tna") > substring > typo > subsequence
 */

/** Half-open [start, end) span in the original (unfolded) string. */
export type Range = [number, number];

export interface FieldInput {
  text: string;
  /** Multiplier for matches in this field; the primary field should be 1. */
  weight: number;
}

interface PreparedField {
  text: string;
  folded: string;
  wordStarts: number[];
  weight: number;
}

export interface SearchMatch<T> {
  item: T;
  score: number;
  /** Highlight ranges keyed by field index (the order `toFields` returned). */
  ranges: Map<number, Range[]>;
}

const isAlnum = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/**
 * Lower-cases and strips accents one UTF-16 unit at a time, so indices in the
 * folded string line up with the original and highlight ranges stay valid.
 */
export function fold(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    out += ch.normalize("NFD")[0].toLowerCase()[0] ?? ch;
  }
  return out;
}

/** Word boundaries: after a separator, or a lower→upper camelCase step. */
function wordStartsOf(text: string, folded: string): number[] {
  const starts: number[] = [];
  for (let i = 0; i < folded.length; i++) {
    if (!isAlnum(folded[i])) continue;
    const prev = text[i - 1];
    const camel = prev && /\p{Ll}/u.test(prev) && /\p{Lu}/u.test(text[i]);
    if (i === 0 || !isAlnum(folded[i - 1]) || camel) starts.push(i);
  }
  return starts;
}

function prepare(field: FieldInput): PreparedField {
  const folded = fold(field.text);
  return {
    text: field.text,
    folded,
    wordStarts: wordStartsOf(field.text, folded),
    weight: field.weight,
  };
}

/** Optimal string alignment distance (Levenshtein plus adjacent transpositions), bailing out above `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prevPrev: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur[j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[b.length];
}

interface TokenMatch {
  score: number;
  ranges: Range[];
}

function better(a: TokenMatch | null, b: TokenMatch | null): TokenMatch | null {
  if (!a) return b;
  if (!b) return a;
  return b.score > a.score ? b : a;
}

function substringMatch(token: string, f: PreparedField): TokenMatch | null {
  const starts = new Set(f.wordStarts);
  let best: TokenMatch | null = null;
  for (
    let idx = f.folded.indexOf(token);
    idx !== -1;
    idx = f.folded.indexOf(token, idx + 1)
  ) {
    const end = idx + token.length;
    const atWord = idx === 0 || starts.has(idx);
    // A lone character mid-word is noise ("a" would match nearly everything).
    if (!atWord && token.length < 2) continue;
    const wholeWord = end === f.folded.length || !isAlnum(f.folded[end]);
    let score: number;
    if (idx === 0 && end === f.folded.length) score = 1;
    else if (idx === 0) score = wholeWord ? 0.95 : 0.9;
    else if (atWord) score = wholeWord ? 0.88 : 0.82;
    else score = token.length >= 3 ? 0.62 : 0.5;
    best = better(best, { score, ranges: [[idx, end]] });
    if (score >= 0.95) break;
  }
  return best;
}

/** "tna" → Training Needs Analysis: the token spells consecutive word initials. */
function acronymMatch(token: string, f: PreparedField): TokenMatch | null {
  if (token.length < 2 || f.wordStarts.length < token.length) return null;
  const initials = f.wordStarts.map((i) => f.folded[i]).join("");
  const at = initials.indexOf(token);
  if (at === -1) return null;
  const ranges = f.wordStarts
    .slice(at, at + token.length)
    .map((i): Range => [i, i + 1]);
  return { score: at === 0 ? 0.8 : 0.74, ranges };
}

/** One or two typos against the start of a word: "jhon" → John, "sefety" → Safety. */
function typoMatch(token: string, f: PreparedField): TokenMatch | null {
  if (token.length < 4) return null;
  const max = token.length >= 8 ? 2 : 1;
  let best: TokenMatch | null = null;
  for (const start of f.wordStarts) {
    let end = start;
    while (end < f.folded.length && isAlnum(f.folded[end])) end++;
    const word = f.folded.slice(start, end);
    // Compare against the word's prefix at a few lengths so a typo in a partly
    // typed word still counts ("trainng" vs "training").
    for (let len = token.length - max; len <= token.length + max; len++) {
      if (len < 3 || len > word.length) continue;
      const d = editDistance(token, word.slice(0, len), max);
      if (d > max) continue;
      const score = (d === 1 ? 0.6 : 0.48) - (start === 0 ? 0 : 0.03);
      best = better(best, { score, ranges: [[start, start + len]] });
    }
  }
  return best;
}

/**
 * Characters in order with gaps: "mgr" → ManaGeR, "dptmgr" → DePartmenT
 * ManaGeR. Letters can skip around inside a word, but the first one has to
 * start a word, and moving on to a later word has to land on its first letter.
 * Without that, "evac" finds grIEVAnCe and "adeline" finds "And pipeLINEs".
 */
function subsequenceMatch(token: string, f: PreparedField): TokenMatch | null {
  if (token.length < 3) return null;
  const { folded, wordStarts } = f;
  const starts = new Set(wordStarts);
  const crossesWord = (from: number, to: number) =>
    wordStarts.some((w) => w > from && w <= to);
  let best: TokenMatch | null = null;
  for (const first of wordStarts) {
    if (folded[first] !== token[0]) continue;
    const positions = [first];
    for (let t = 1; t < token.length; t++) {
      const prev = positions[t - 1];
      // Nearest allowed occurrence, but a word start a little further on wins.
      let next = -1;
      for (let i = prev + 1; i < folded.length; i++) {
        if (folded[i] !== token[t]) continue;
        if (!starts.has(i) && crossesWord(prev, i)) continue;
        if (next === -1) next = i;
        if (starts.has(i)) {
          next = i;
          break;
        }
        if (i - next > 8) break;
      }
      if (next === -1) break;
      positions.push(next);
    }
    if (positions.length < token.length) continue;
    const span = positions[positions.length - 1] - first + 1;
    if (span > token.length * 3) continue;
    const boundaryHits = positions.filter((p) => starts.has(p)).length;
    const score =
      0.3 + 0.2 * (token.length / span) + 0.1 * (boundaryHits / token.length);
    const ranges: Range[] = [];
    for (const p of positions) {
      const last = ranges[ranges.length - 1];
      if (last && last[1] === p) last[1] = p + 1;
      else ranges.push([p, p + 1]);
    }
    best = better(best, { score, ranges });
  }
  return best;
}

function matchToken(token: string, f: PreparedField): TokenMatch | null {
  const sub = substringMatch(token, f);
  if (sub && sub.score >= 0.82) return sub;
  let best = better(sub, acronymMatch(token, f));
  if (best && best.score >= 0.74) return best;
  best = better(best, typoMatch(token, f));
  if (best) return best;
  return subsequenceMatch(token, f);
}

function mergeRanges(ranges: Range[]): Range[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function tokenize(query: string): string[] {
  return fold(query)
    .split(/\s+/)
    .filter((t) => /[\p{L}\p{N}]/u.test(t));
}

function scorePrepared(
  query: string,
  tokens: string[],
  fields: PreparedField[],
) {
  const ranges = new Map<number, Range[]>();
  let total = 0;
  for (const token of tokens) {
    let bestScore = 0;
    let bestField = -1;
    let bestRanges: Range[] = [];
    fields.forEach((f, i) => {
      const m = matchToken(token, f);
      if (m && m.score * f.weight > bestScore) {
        bestScore = m.score * f.weight;
        bestField = i;
        bestRanges = m.ranges;
      }
    });
    if (bestField === -1) return null;
    total += bestScore;
    ranges.set(bestField, [...(ranges.get(bestField) ?? []), ...bestRanges]);
  }
  let score = total / tokens.length;

  // Reward the whole query reading straight off the start of the primary field,
  // so "needs analysis" ranks "Needs Analysis…" above "…Training Needs Analysis".
  const primary = fields[0]?.folded ?? "";
  const phrase = fold(query).trim().replace(/\s+/g, " ");
  if (tokens.length > 1 && phrase) {
    if (primary.startsWith(phrase)) score += 0.15;
    else if (primary.includes(phrase)) score += 0.08;
  }
  // All tokens landing on the primary field beats a scatter across secondary ones.
  if (ranges.size === 1 && ranges.has(0)) score += 0.03;

  for (const [k, v] of ranges) ranges.set(k, mergeRanges(v));
  return { score, ranges };
}

/** Score one item's fields against a query; null if any token fails to match. */
export function scoreFields(query: string, fields: FieldInput[]) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return null;
  return scorePrepared(query, tokens, fields.map(prepare));
}

export interface SearchIndex<T> {
  search(
    query: string,
    opts?: { limit?: number; boost?: (item: T) => number },
  ): SearchMatch<T>[];
}

/**
 * Pre-folds every item's fields once so each keystroke only pays for matching.
 * Ties keep the input order, so pass items pre-sorted by whatever should win
 * a tie (alphabetical, most relevant first, …).
 */
export function createSearchIndex<T>(
  items: T[],
  toFields: (item: T) => FieldInput[],
): SearchIndex<T> {
  const prepared = items.map((item) => ({
    item,
    fields: toFields(item).map(prepare),
  }));
  return {
    search(query, { limit = Infinity, boost } = {}) {
      const tokens = tokenize(query);
      if (tokens.length === 0) return [];
      const out: (SearchMatch<T> & { order: number })[] = [];
      prepared.forEach(({ item, fields }, order) => {
        const r = scorePrepared(query, tokens, fields);
        if (r)
          out.push({
            item,
            score: r.score * (boost?.(item) ?? 1),
            ranges: r.ranges,
            order,
          });
      });
      out.sort((a, b) => b.score - a.score || a.order - b.order);
      return out
        .slice(0, limit)
        .map(({ item, score, ranges }) => ({ item, score, ranges }));
    },
  };
}
