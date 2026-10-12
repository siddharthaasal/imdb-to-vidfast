import { movieUrl } from './config.js';
import { detectTitle } from './detect.js';

const IMDB_TITLE_URL = /^https:\/\/([a-z]+\.)?imdb\.com\/([a-z-]+\/)?title\/tt\d{7,}/i;

async function flashBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2000);
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

  if (result?.type === 'movie') {
    await chrome.tabs.create({
      url: movieUrl(result.id),
      index: tab.index + 1,
      openerTabId: tab.id,
      active: true,
    });
    return;
  }

  // Series and episodes arrive in Phase 2.
  console.info('VidFast launcher: not a movie yet', result);
  await flashBadge(tab.id, '?');
});
