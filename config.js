// The only place the VidFast domain lives. Change it here if VidFast moves.
export const VIDFAST_BASE = 'https://vidfast.pro';

export const movieUrl = (id) => `${VIDFAST_BASE}/movie/${id}`;
export const tvUrl = (seriesId, season, episode) =>
  `${VIDFAST_BASE}/tv/${seriesId}/${season}/${episode}`;
