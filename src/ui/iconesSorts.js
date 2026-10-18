// Icônes des sorts avancés (appris pendant la run) : ils n'ont pas d'image, on dessine leur emoji
// (`emoji` dans sorts.json) sur une pastille en SVG, sans fichier ajouté.
import { SORTS } from "../data/index.js";

const cache = new Map();
/** Image (data: SVG) de l'emoji d'un sort, ou null si le sort a sa propre image. */
export function iconeEmojiSort(sortId) {
  const emoji = SORTS[sortId]?.emoji;
  if (!emoji) {
    return null;
  }
  if (!cache.has(sortId)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="f" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#fff4d8"/><stop offset="1" stop-color="#d09a5c"/></radialGradient></defs><rect x="2" y="2" width="60" height="60" rx="14" fill="url(#f)" stroke="#6b3f17" stroke-width="3"/><text x="32" y="45" font-size="34" text-anchor="middle" font-family="Apple Color Emoji,Segoe UI Emoji,Noto Color Emoji,sans-serif">${emoji}</text></svg>`;
    cache.set(sortId, `data:image/svg+xml,${encodeURIComponent(svg)}`);
  }
  return cache.get(sortId);
}
