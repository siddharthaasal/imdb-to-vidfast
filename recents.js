// Launch history in chrome.storage.local: newest first, one entry per
// movie or show, at most MAX_RECENTS entries.
//
// Entry shape: { id, type: 'movie' | 'tv', title, season, episode, openedAt }
// For shows, id is the series ID and season/episode is the last one opened.

const KEY = 'recents';
export const MAX_RECENTS = 5;

export async function getRecents() {
  const { [KEY]: list = [] } = await chrome.storage.local.get(KEY);
  return list;
}

export async function findRecent(id) {
  return (await getRecents()).find((e) => e.id === id) || null;
}

export async function saveRecent(entry) {
  const rest = (await getRecents()).filter((e) => e.id !== entry.id);
  const list = [{ ...entry, openedAt: Date.now() }, ...rest].slice(0, MAX_RECENTS);
  await chrome.storage.local.set({ [KEY]: list });
}

export async function removeRecent(id) {
  const list = (await getRecents()).filter((e) => e.id !== id);
  await chrome.storage.local.set({ [KEY]: list });
}

export function onRecentsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[KEY]) callback(changes[KEY].newValue || []);
  });
}

// "S2 E5" for shows, '' for movies.
export const episodeLabel = (entry) =>
  entry.type === 'tv' ? `S${entry.season} E${entry.episode}` : '';
