// Runs inside the IMDb page via chrome.scripting.executeScript({ func: detectTitle }).
// Chrome serialises the function, so it must stay self-contained: no imports,
// no references to anything outside its body.
export function detectTitle() {
  const match = location.pathname.match(/\/title\/(tt\d{7,})/);
  if (!match) return null;
  const id = match[1];

  let rawType = null;
  let title = null;

  // Primary source: the JSON-LD block IMDb embeds in every title page.
  for (const el of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(el.textContent);
      if (data && data['@type']) {
        rawType = data['@type'];
        title = data.name || data.alternateName || null;
        break;
      }
    } catch {
      // Malformed block; try the next one.
    }
  }

  // Fallback: Next.js page data, which has finer-grained types (tvMovie, short...).
  let nextType = null;
  try {
    const next = JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent || 'null');
    const above = next?.props?.pageProps?.aboveTheFoldData;
    nextType = above?.titleType?.id || null;
    title = title || above?.titleText?.text || null;
  } catch {
    // No Next.js data on this page.
  }

  const MOVIE_NEXT_TYPES = ['movie', 'tvMovie', 'short', 'video'];
  let type = 'other';
  if (rawType === 'Movie') type = 'movie';
  else if (!rawType && MOVIE_NEXT_TYPES.includes(nextType)) type = 'movie';

  return { id, type, title, rawType: rawType || nextType };
}
