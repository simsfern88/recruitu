import "server-only";

/**
 * URL ingestion is a convenience that degrades gracefully. If a scrape fails —
 * bot wall, JS-only page, timeout — we do NOT surface a dead error; we signal
 * the caller to fall back to "paste the text instead". The raw source we DO get
 * is always kept so a better parse can be re-run later.
 */
export type ScrapeResult =
  | { ok: true; text: string }
  | { ok: false; reason: string };

async function fetchHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; reason: string }> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; RecruitU/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, reason: `Site returned ${res.status}.` };
    return { ok: true, html: await res.text() };
  } catch {
    return { ok: false, reason: "Couldn't reach that URL." };
  }
}

// Crude readability pass: strip scripts/styles/tags, collapse whitespace.
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const fetched = await fetchHtml(url);
  if (!fetched.ok) return fetched;

  const text = htmlToText(fetched.html);
  if (text.length < 200) {
    return { ok: false, reason: "Couldn't read enough text from that page." };
  }
  return { ok: true, text };
}

/* ----------------------------------------------------- company-site crawl */

// Pages whose URL path or link text mentions one of these are the ones worth
// actually reading — everything else (pricing, blog posts, legal, contact)
// is skipped rather than crawled indiscriminately.
const RELEVANT_LINK_HINTS = [
  "about",
  "careers",
  "jobs",
  "team",
  "mission",
  "company",
  "culture",
  "story",
  "who-we-are",
  "values",
  "people",
  "life-at",
];

// Kept deliberately small — this text gets resent as input on every single
// generation call for a job (parse, score, resume, cover letter, cheat
// sheet, question pack), so its size multiplies straight into API cost.
const MAX_SUBPAGES = 3;
const PER_PAGE_CHAR_CAP = 2000;

/** Same site as the homepage, allowing for a subdomain either direction
 * (e.g. careers.acme.com from acme.com, or vice versa). */
function isSameSite(a: URL, b: URL): boolean {
  return (
    a.hostname === b.hostname ||
    a.hostname.endsWith(`.${b.hostname}`) ||
    b.hostname.endsWith(`.${a.hostname}`)
  );
}

/** Pulls same-site links out of raw homepage HTML, keeping only ones whose
 * URL path or visible link text suggests they describe the company, ranked
 * by how many hint keywords they match. */
function findRelevantLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>([base.toString()]);
  const scored: { url: string; score: number }[] = [];

  const linkRe = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html))) {
    const [, href, innerHtml] = match;

    let absolute: URL;
    try {
      absolute = new URL(href, base);
    } catch {
      continue;
    }
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") continue;
    if (!isSameSite(absolute, base)) continue;

    absolute.hash = "";
    const normalized = absolute.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const linkText = innerHtml.replace(/<[^>]+>/g, " ").toLowerCase();
    const path = absolute.pathname.toLowerCase();
    const score = RELEVANT_LINK_HINTS.filter(
      (hint) => path.includes(hint) || linkText.includes(hint),
    ).length;
    if (score > 0) scored.push({ url: normalized, score });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SUBPAGES)
    .map((s) => s.url);
}

/**
 * A lightweight crawl from a company's homepage: reads the homepage, then
 * follows a handful of same-site links that look like About/Careers/Team/
 * Mission pages (by URL and link-text keywords) and reads those too. Not a
 * general-purpose crawler — it never leaves the site, never goes more than
 * one hop deep, and only follows links that plausibly describe the company.
 * Best-effort throughout: a sub-page that fails to fetch is just skipped;
 * only a failed homepage fetch fails the whole thing.
 */
export async function scrapeCompanySite(url: string): Promise<ScrapeResult> {
  const home = await fetchHtml(url);
  if (!home.ok) return home;

  const homeText = htmlToText(home.html).slice(0, PER_PAGE_CHAR_CAP);
  if (homeText.length < 200) {
    return { ok: false, reason: "Couldn't read enough text from that page." };
  }

  const subpageUrls = findRelevantLinks(home.html, url);
  const subpages = await Promise.all(
    subpageUrls.map(async (pageUrl) => {
      const fetched = await fetchHtml(pageUrl);
      if (!fetched.ok) return null;
      const text = htmlToText(fetched.html).slice(0, PER_PAGE_CHAR_CAP);
      return text.length >= 200 ? { url: pageUrl, text } : null;
    }),
  );

  const sections = [
    `--- ${url} ---\n${homeText}`,
    ...subpages
      .filter((p): p is { url: string; text: string } => p !== null)
      .map((p) => `--- ${p.url} ---\n${p.text}`),
  ];

  return { ok: true, text: sections.join("\n\n") };
}
