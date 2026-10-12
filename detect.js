// Runs inside the IMDb page via chrome.scripting.executeScript({ func: detectTitle }).
// Chrome serialises the function, so it must stay self-contained: no imports,
// no references to anything outside its body.
//
// Returns { id, type, title, rawType, seriesId, seriesTitle, season, episode }
// where type is 'movie' | 'series' | 'episode' | 'other'.
export function detectTitle() {
  const match = location.pathname.match(/\/title\/(tt\d{7,})/);
  if (!match) return null;
  const id = match[1];

  const titleIdFromHref = (href) => href?.match(/\/title\/(tt\d{7,})/)?.[1] || null;
  const toNumber = (value) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) ? n : null;
  };

  // Primary source: the JSON-LD block IMDb embeds in every title page.
  let ld = null;
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent);
      if (data && data['@type']) {
        ld = data;
        break;
      }
    } catch {
      // Malformed block; try the next one.
    }
  }

  // Second source: Next.js page data, which has finer-grained types and
  // the series / season / episode details for episode pages.
  let above = null;
  try {
    const next = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || 'null');
    above = next?.props?.pageProps?.aboveTheFoldData || null;
  } catch {
    // No Next.js data on this page.
  }

  const rawType = ld?.['@type'] || null;
  const nextType = above?.titleType?.id || null;
  const title = ld?.name || ld?.alternateName || above?.titleText?.text || null;

  let type = 'other';
  if (rawType === 'Movie') type = 'movie';
  else if (rawType === 'TVSeries' || rawType === 'TVMiniSeries') type = 'series';
  else if (rawType === 'TVEpisode') type = 'episode';
  else if (['movie', 'tvMovie', 'short', 'video'].includes(nextType)) type = 'movie';
  else if (['tvSeries', 'tvMiniSeries'].includes(nextType)) type = 'series';
  else if (nextType === 'tvEpisode') type = 'episode';

  const result = {
    id,
    type,
    title,
    rawType: rawType || nextType,
    seriesId: null,
    seriesTitle: null,
    season: null,
    episode: null,
  };

  if (type === 'series') {
    result.seriesId = id;
    result.seriesTitle = title;
  }

  if (type === 'episode') {
    const seriesLink = document.querySelector(
      '[data-testid="hero-title-block__series-link"], a[data-testid*="series-link"]'
    );

    // Series ID: page data, then JSON-LD, then the "back to series" link.
    // Never fall back to the episode's own ID.
    const candidates = [
      above?.series?.series?.id,
      titleIdFromHref(ld?.partOfSeries?.url),
      titleIdFromHref(seriesLink?.getAttribute('href')),
    ];
    result.seriesId = candidates.find((c) => c && c !== id) || null;
    result.seriesTitle =
      above?.series?.series?.titleText?.text ||
      ld?.partOfSeries?.name ||
      seriesLink?.textContent?.trim() ||
      null;

    // Season and episode: page data first, then the visible "S2.E5" label.
    const nums = above?.series?.episodeNumber;
    result.season = toNumber(nums?.seasonNumber);
    result.episode = toNumber(nums?.episodeNumber);

    if (result.season == null || result.episode == null) {
      const labelEl = document.querySelector(
        '[data-testid="hero-subnav-bar-season-episode-numbers-section"]'
      );
      const text = labelEl?.textContent || document.body?.innerText || '';
      const label = text.match(/\bS(\d+)\s*\.?\s*E(\d+)\b/);
      if (label) {
        result.season = toNumber(label[1]);
        result.episode = toNumber(label[2]);
      }
    }
  }

  return result;
}
