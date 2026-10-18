// Récompense de l'Almanax versée à une run qui commence (séparé de almanax.js, que la sauvegarde de
// la méta importe : pas de dépendance vers les reliques de run).
import { prendreRecompenseAlmanax, KAMAS_ALMANAX } from "./almanax.js";
import { ECONOMIE, getMonde } from "./config.js";
import { ajouterKamas, numeroZone } from "./economie.js";
import { appliquerChoix, tirerReliqueRun } from "./recompensesRun.js";

/** Kamas de départ de l'Almanax pour un monde : 3 combats durs de sa première zone. */
export function kamasAlmanax(trancheId) {
  const premiere = getMonde(trancheId)?.zones?.[0];
  const toile = premiere ? numeroZone(premiere) : 1;
  return Math.round(
    KAMAS_ALMANAX * ECONOMIE.gain.combat_dur * (1 + ECONOMIE.gainParToile * (toile - 1)),
  );
}
/**
 * Verse la récompense en attente (kamas, ou relique de run commune ; des kamas si toutes les
 * communes sont prises) et la retire de la méta. Renvoie le texte du bandeau, ou `` s'il n'y avait rien.
 */
export function verserRecompenseAlmanax(meta, run, rng = Math.random) {
  const recompense = prendreRecompenseAlmanax(meta);
  if (!recompense) {
    return ``;
  }
  if (recompense.type === `relique`) {
    const relique = tirerReliqueRun(run, rng, `commun`);
    if (relique) {
      return `📅 Almanax : ${appliquerChoix(run, relique)}`;
    }
  }
  const montant = kamasAlmanax(run.trancheId);
  ajouterKamas(run, montant);
  return `📅 Almanax : +${montant} kamas de départ`;
}
