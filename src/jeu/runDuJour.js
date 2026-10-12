// Run du jour : même graine pour tout le monde le même jour (date locale), aucune donnée en ligne.
// La graine fixe les cartes des zones ; une bénédiction est imposée, dans l'esprit du Dolmanax.
import { BENEDICTIONS } from "./rencontres.js";

/** Date locale au format AAAA-MM-JJ (le jour change à minuit, heure de l'appareil). */
export function dateDuJour(date = new Date()) {
  const deux = (nombre) => String(nombre).padStart(2, `0`);
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}`;
}

/** Graine entière 32 bits tirée d'un texte (FNV-1a). */
export function graineDeTexte(texte) {
  let hash = 0x811c9dc5;
  for (const caractere of String(texte)) {
    hash = Math.imul(hash ^ caractere.codePointAt(0), 0x01000193) >>> 0;
  }
  return hash;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32), même contrat que `Math.random`. */
export function rngGraine(graine) {
  let etat = graine >>> 0;
  return () => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let valeur = etat;
    valeur = Math.imul(valeur ^ (valeur >>> 15), valeur | 1);
    valeur ^= valeur + Math.imul(valeur ^ (valeur >>> 7), valeur | 61);
    return ((valeur ^ (valeur >>> 14)) >>> 0) / 4294967296;
  };
}

/** Bénédiction imposée ce jour-là (identifiant de `BENEDICTIONS`). */
export function benedictionDuJour(date) {
  const ids = Object.keys(BENEDICTIONS);
  return ids[Math.floor(rngGraine(graineDeTexte(`benediction:${date}`))() * ids.length)];
}

/** Générateur de la carte d'une zone de la run du jour (même carte pour un monde et un jour donnés). */
export const rngCarteDuJour = (date, trancheId, zoneIdx) =>
  rngGraine(graineDeTexte(`carte:${date}:${trancheId}:${zoneIdx}`));

/** Clé du score de la run du jour dans `meta.records` (un record par jour et par monde). */
export const cleRecordJour = (date, trancheId) => `jour:${date}:${trancheId}`;
