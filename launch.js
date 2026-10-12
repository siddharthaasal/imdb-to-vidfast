import { movieUrl, tvUrl } from './config.js';
import { saveRecent } from './recents.js';

export const entryUrl = (entry) =>
  entry.type === 'movie' ? movieUrl(entry.id) : tvUrl(entry.id, entry.season, entry.episode);

// Open an entry in a new focused tab beside sourceTab, then record it in history.
// `unsure` puts a "?" badge on the new tab (season/episode couldn't be read).
export async function launch(entry, sourceTab, { unsure = false } = {}) {
  const placement = sourceTab ? { index: sourceTab.index + 1, openerTabId: sourceTab.id } : {};
  const newTab = await chrome.tabs.create({ url: entryUrl(entry), active: true, ...placement });

  if (unsure) {
    await chrome.action.setBadgeText({ tabId: newTab.id, text: '?' });
  }
  await saveRecent(entry);
  return newTab;
}
