import { movieUrl, tvUrl } from './config.js';
import { detectTitle } from './detect.js';

const IMDB_TITLE_URL = /^https:\/\/([a-z]+\.)?imdb\.com\/([a-z-]+\/)?title\/tt\d{7,}/i;

async function flashBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2000);
}

const isPositive = (n) => Number.isInteger(n) && n >= 1;

// Decide where to go. Returns { url, unsure } or null if nothing sensible can open.
function buildTarget(info) {
  if (info?.type === 'movie') return { url: movieUrl(info.id), unsure: false };

  if (info?.type === 'series') return { url: tvUrl(info.id, 1, 1), unsure: false };

  if (info?.type === 'episode') {
    // Without the parent series ID VidFast can't play anything.
    if (!info.seriesId) return null;
    if (isPositive(info.season) && isPositive(info.episode)) {
      return { url: tvUrl(info.seriesId, info.season, info.episode), unsure: false };
    }
    // Season or episode unreadable ("Unknown", specials...): start the show at S1 E1.
    return { url: tvUrl(info.seriesId, 1, 1), unsure: true };
  }

  return null;
}

chrome.action.onClicked.addListener(async (tab) => {
  // Non-IMDb tabs do nothing for now; Phase 4 gives them the recents popup.
  if (!tab.url || !IMDB_TITLE_URL.test(tab.url)) return;

  let result;
  try {
    [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: detectTitle,
    });
  } catch (err) {
    console.warn('VidFast launcher: could not read the page', err);
    await flashBadge(tab.id, '?');
    return;
  }

  const target = buildTarget(result);
  if (!target) {
    console.info('VidFast launcher: nothing to open for', result);
    await flashBadge(tab.id, '?');
    return;
  }

  const newTab = await chrome.tabs.create({
    url: target.url,
    index: tab.index + 1,
    openerTabId: tab.id,
    active: true,
  });

  // The new tab has focus, so put the "?" there where it will be seen.
  if (target.unsure) {
    await chrome.action.setBadgeText({ tabId: newTab.id, text: '?' });
  }
});
