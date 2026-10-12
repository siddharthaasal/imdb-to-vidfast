import { getRecents, removeRecent, onRecentsChanged, episodeLabel } from './recents.js';

const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

// "Just now", "12 min ago", "3 h ago", "Yesterday", "4 days ago", "12 Mar".
function timeAgo(ms) {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function render(list) {
  listEl.replaceChildren();
  listEl.hidden = list.length === 0;
  emptyEl.hidden = list.length > 0;

  for (const entry of list) {
    const name = entry.title || entry.id;
    const kind = entry.type === 'tv' ? 'Series' : 'Movie';
    const meta = entry.openedAt ? `${kind} · ${timeAgo(entry.openedAt)}` : kind;

    const open = el('button', 'open');
    open.title = `Open ${name} in VidFast`;
    const text = el('span', 'text');
    text.append(el('span', 'title', name), el('span', 'meta', meta));
    open.append(text);
    const label = episodeLabel(entry);
    if (label) open.append(el('span', 'tag', label));

    open.addEventListener('click', async () => {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      await chrome.runtime.sendMessage({ type: 'launch', entry, sourceTab: activeTab });
      window.close();
    });

    const remove = el('button', 'remove', '×');
    remove.title = 'Remove from recents';
    remove.setAttribute('aria-label', `Remove ${name}`);
    remove.addEventListener('click', () => removeRecent(entry.id));

    const li = el('li');
    li.append(open, remove);
    listEl.append(li);
  }
}

getRecents().then(render);
onRecentsChanged(render);
