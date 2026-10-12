import { detectTitle } from './detect.js';
import { launch } from './launch.js';
import { findRecent, getRecents, onRecentsChanged, episodeLabel } from './recents.js';

const IMDB_URL = /^https:\/\/([a-z]+\.)?imdb\.com\//i;
const IMDB_TITLE_URL = /^https:\/\/([a-z]+\.)?imdb\.com\/([a-z-]+\/)?title\/tt\d{7,}/i;
const POPUP = 'popup.html';
const MENU_PREFIX = 'recent:';

async function flashBadge(tabId, text) {
  await chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 2000);
}

async function detectInTab(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: detectTitle,
    });
    return result;
  } catch (err) {
    console.warn('VidFast launcher: could not read the page', err);
    return null;
  }
}

const isPositive = (n) => Number.isInteger(n) && n >= 1;

// Turn what detect.js found into a history entry.
// Returns { entry, unsure } or null if nothing sensible can open.
async function buildEntry(info) {
  if (info?.type === 'movie') {
    return {
      entry: { id: info.id, type: 'movie', title: info.title, season: null, episode: null },
      unsure: false,
    };
  }

  if (info?.type === 'series') {
    // Resume where we left off; otherwise start at S1 E1.
    const previous = await findRecent(info.id);
    const resume = previous?.type === 'tv';
    return {
      entry: {
        id: info.id,
        type: 'tv',
        title: info.title || previous?.title,
        season: resume ? previous.season : 1,
        episode: resume ? previous.episode : 1,
      },
      unsure: false,
    };
  }

  if (info?.type === 'episode') {
    // Without the parent series ID VidFast can't play anything.
    if (!info.seriesId) return null;
    const known = isPositive(info.season) && isPositive(info.episode);
    const previous = info.seriesTitle ? null : await findRecent(info.seriesId);
    return {
      entry: {
        id: info.seriesId,
        type: 'tv',
        title: info.seriesTitle || previous?.title || info.title,
        // Season or episode unreadable ("Unknown", specials...): start the show at S1 E1.
        season: known ? info.season : 1,
        episode: known ? info.episode : 1,
      },
      unsure: !known,
    };
  }

  return null;
}

// ---- Icon click (IMDb title tabs only; every other tab gets the popup) ----

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || !IMDB_TITLE_URL.test(tab.url)) return;

  const target = await buildEntry(await detectInTab(tab.id));
  if (!target) {
    await flashBadge(tab.id, '?');
    return;
  }
  await launch(target.entry, tab, { unsure: target.unsure });
});

// ---- Per-tab icon behaviour ----

async function refreshAction(tab) {
  const tabId = tab.id;
  const url = tab.url || '';

  if (IMDB_TITLE_URL.test(url)) {
    // Click opens VidFast directly.
    await chrome.action.setPopup({ tabId, popup: '' });
    await chrome.action.enable(tabId);

    // Once the page has loaded, grey out titles VidFast can't play
    // (video games, podcasts...). Only trust a positive "other" reading:
    // a missing rawType means the page data wasn't readable yet.
    if (tab.status === 'complete') {
      const info = await detectInTab(tabId);
      if (info?.type === 'other' && info.rawType) await chrome.action.disable(tabId);
    }
  } else if (IMDB_URL.test(url)) {
    // Other IMDb pages (people, lists...): nothing to play.
    await chrome.action.setPopup({ tabId, popup: '' });
    await chrome.action.disable(tabId);
  } else {
    // Everywhere else: show recents.
    await chrome.action.setPopup({ tabId, popup: POPUP });
    await chrome.action.enable(tabId);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status) {
    refreshAction(tab).catch((err) => console.warn('VidFast launcher: refresh failed', err));
  }
});

async function refreshAllTabs() {
  for (const tab of await chrome.tabs.query({})) {
    await refreshAction(tab).catch(() => {});
  }
}

// ---- Right-click menu on the icon: recent titles ----

// Rebuilds are chained so two can't interleave and create duplicate IDs.
let menuQueue = Promise.resolve();
function rebuildMenu(list) {
  menuQueue = menuQueue.then(() => buildMenu(list)).catch((err) =>
    console.warn('VidFast launcher: menu rebuild failed', err)
  );
  return menuQueue;
}

async function buildMenu(list) {
  await chrome.contextMenus.removeAll();
  if (!list.length) {
    chrome.contextMenus.create({
      id: 'recent-empty',
      title: 'No recent titles yet',
      contexts: ['action'],
      enabled: false,
    });
    return;
  }
  for (const entry of list) {
    const label = episodeLabel(entry);
    chrome.contextMenus.create({
      id: MENU_PREFIX + entry.id,
      title: label ? `${entry.title} · ${label}` : entry.title,
      contexts: ['action'],
    });
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (typeof info.menuItemId !== 'string' || !info.menuItemId.startsWith(MENU_PREFIX)) return;
  const id = info.menuItemId.slice(MENU_PREFIX.length);
  const entry = (await getRecents()).find((e) => e.id === id);
  if (entry) await launch(entry, tab);
});

onRecentsChanged((list) => rebuildMenu(list));

// ---- Popup row clicks ----
// The popup closes as soon as the new tab takes focus, so it hands the
// launch to the service worker, which outlives it.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'launch' && message.entry) {
    launch(message.entry, message.sourceTab).catch((err) =>
      console.warn('VidFast launcher: launch failed', err)
    );
    sendResponse({ ok: true }); // reply at once so the popup can close
  }
});

async function init() {
  await rebuildMenu(await getRecents());
  await refreshAllTabs();
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
