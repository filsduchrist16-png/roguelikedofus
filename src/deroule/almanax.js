// Almanax du jour pendant une run : progrès noté à chaque évènement (hors Songes), bandeau quand la
// quête est accomplie, récompense versée au départ de la run suivante.
import { TEXTES_RECOMPENSE, etatAlmanax, progresserAlmanax } from "../jeu/almanax.js";
import { verserRecompenseAlmanax } from "../jeu/almanaxRun.js";
import { sauverMeta } from "../sauvegarde/meta.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";

/** Note un évènement de run (`combat`, `zone`, `camp`, `coffre`) pour la quête du jour. */
export function noterAlmanax(meta, type, donnees = {}) {
  const { change, accompli } = progresserAlmanax(meta, { ...donnees, type });
  if (change) {
    sauverMeta(meta);
  }
  if (accompli) {
    const { quete, recompense } = etatAlmanax(meta);
    afficherBandeau(
      `📅 Almanax accompli : ${quete.texte}. Récompense : ${TEXTES_RECOMPENSE[recompense]}`,
    );
  }
  return accompli;
}
/** Récompense en attente versée à la run qui commence (bandeau, méta sauvegardée). */
export function verserAlmanax(meta, run) {
  const texte = verserRecompenseAlmanax(meta, run);
  if (texte) {
    sauverMeta(meta);
    afficherBandeau(texte);
  }
  return texte;
}
