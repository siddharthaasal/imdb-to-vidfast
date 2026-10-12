# VidFast launcher: build list

A Chrome extension that opens the IMDb title you're looking at in VidFast with one click, and remembers your last five.

## How the link is built

```
vidfast.pro/movie/{imdbId}
vidfast.pro/tv/{seriesImdbId}/{season}/{episode}
```

The path (`movie` or `tv`) picks the player. For episodes, the ID must be the **series** ID, not the episode's own IMDb ID. Everything the extension does is reading these values off the IMDb page and building this link.

## Assumptions

- Clicking the icon on an IMDb title page opens VidFast straight away; on any other page it shows the recent list.
- The new tab opens next to the current one and takes focus.
- History keeps one entry per show, so bingeing a series doesn't push other titles out.
- A series page with no history opens S1 E1; with history, it resumes the last episode.
- Plain JavaScript, no framework or build step, desktop Chrome only.

## Phase 0: Set up the project

- [x] **Confirm the VidFast links still work.** Open `vidfast.pro/movie/tt0111161` and `vidfast.pro/tv/tt0903747/2/5` in the browser.
  *Done when:* both play the right title and episode.
- [x] **Create the folder and `manifest.json`.** Manifest V3, with permissions for `storage`, `scripting`, `activeTab` and `contextMenus`, plus host access to `imdb.com`.
  *Done when:* Load unpacked in `chrome://extensions` shows it with no errors.
- [x] **Add `config.js` with the VidFast base URL.** One constant, so a domain change is a one-line fix.
  *Done when:* nothing else in the code hard-codes `vidfast.pro`.

## Phase 1: Movies in one click

- [x] **Write `detect.js` to read the title ID.** Pull the `tt` ID from the URL, allowing for `m.imdb.com` and regional paths like `/fr/title/`.
  *Done when:* it returns the right ID on desktop, mobile and regional IMDb pages.
- [x] **Read the title type and name from the page.** Use the structured data (JSON-LD) IMDb embeds in every title page. Movie, TV movie and Short all count as movies.
  *Done when:* it returns type and title for three different movies.
- [x] **Wire up the icon click in `background.js`.** Run `detect.js` on the current tab, build the movie link, open it in a new tab beside this one.
  *Done when:* one click on a movie page opens the right VidFast movie.

## Phase 2: Series and episodes

- [x] **Handle series pages.** Series and mini-series open as TV, S1 E1.
  *Done when:* a series page opens the TV player, not the movie one.
- [x] **Find the parent series on episode pages.** Get the series ID from the page's series link or embedded data, never the episode's own ID.
  *Done when:* an episode page opens the show, not a blank player.
- [x] **Read the season and episode numbers.** Use two methods: IMDb's embedded page data, and the visible `S2.E5` label as a fallback.
  *Done when:* a mid-season episode opens exactly that episode.
- [x] **Fail gracefully when numbers are missing.** If season or episode can't be read, open the series at S1 E1 and show a `?` badge on the icon.
  *Done when:* an episode with season "Unknown" still opens something sensible.

## Phase 3: Remember the last five

- [ ] **Save each launch to `chrome.storage.local`.** Store ID, type, title, season, episode and when it was opened. One entry per show; keep the newest five.
  *Done when:* opening six titles drops the oldest, and three episodes of one show leave one entry.
- [ ] **Resume shows from history.** If a series page's show is already in history, open the last episode instead of S1 E1.
  *Done when:* reopening a show's main page picks up where you left off.
- [ ] **Build the recent-titles popup.** Five rows with title, plus S/E for shows. Click a row to reopen it; × removes it. The empty state says how to add one.
  *Done when:* every row reopens the right thing and × removes it.

## Phase 4: Make the icon behave

- [ ] **Switch the icon's behaviour per tab.** No popup on IMDb title tabs (click opens VidFast); popup on every other tab. Update it when tabs change or load.
  *Done when:* clicking on IMDb opens VidFast, and clicking on any other site shows recents.
- [ ] **List recents in the icon's right-click menu.** So history is reachable on IMDb, where the click is taken.
  *Done when:* right-clicking the icon on IMDb shows your five titles and each one opens.
- [ ] **Grey out the icon on pages VidFast can't play.** IMDb pages for people, video games, podcasts and lists.
  *Done when:* clicking on a person's page does nothing harmful.

## Phase 5: Edge cases and polish

- [ ] **Test whether switching episodes inside VidFast changes its URL.** Open an episode, pick the next one in VidFast's player, watch the address bar.
  *Done when:* you know which of the next two tasks to do.
- [ ] *(Optional)* **If the URL changes, keep history in sync.** Watch VidFast tabs and update that show's entry to the new episode.
  *Done when:* history shows the episode you actually stopped on.
- [ ] *(Optional)* **If it doesn't, add a "Next episode" button in the popup.** Opens the following episode and updates history.
  *Done when:* one click moves you from S2 E5 to S2 E6.
- [ ] **Handle season 0 specials.** Check how VidFast numbers them and map accordingly.
  *Done when:* a special opens the right video or fails with the `?` badge.
- [ ] *(Optional)* **Episodes list page opens that season.** `/episodes/?season=3` opens S3 E1.
  *Done when:* it works for any season number.
- [ ] **Add proper icons.** 16, 48 and 128 px, plus a greyed version.
  *Done when:* it's recognisable in the toolbar.

## Later

- **TMDB support.** Add a second detector for themoviedb.org pages that returns the same `{ id, type, season, episode }` shape as the IMDb one. Nothing else should need to change.

## Working with Claude Code

Hand it one phase at a time and test each before starting the next. Phases 1 and 2 are where most of the real work is.