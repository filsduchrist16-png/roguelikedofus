// Badges des cartes de combat pour les contenus de la 1.9.0 : capacité spéciale d'un boss (et sa
// frappe préparée, ⚠️ bien visible) et affixes portés par un monstre (vampirique, explosif…).
import { TEXTES_CIBLE_TELEGRAPHE } from "../combat/capacites.js";

const ICONES = { invocation: `📯`, bouclier: `🛡️`, bourrasque: `🌪️`, telegraphe: `⚠️` };

/** Badges { texte, tip, classe } d'un combattant pour sa capacité de boss et ses affixes. */
export function badgesContenu(combattant) {
  const badges = [];
  const capacite = combattant.capacite;
  if (capacite && combattant.pvActuels > 0) {
    const charge = combattant.capaciteEnCharge;
    if (charge) {
      const restant = Math.max(0, charge.seuil - (charge.pv - combattant.pvActuels));
      badges.push({
        texte: `⚠️ ${capacite.nom} : prochain tour !`,
        tip: `${combattant.nom} se concentre : au début de son prochain tour, ${TEXTES_CIBLE_TELEGRAPHE[capacite.cible] ?? TEXTES_CIBLE_TELEGRAPHE.equipe} subira une lourde frappe. Encore ${restant} PV à lui retirer (ou assomme-le) pour l'interrompre.`,
        classe: `alerte`,
      });
    } else {
      badges.push({
        texte: `${ICONES[capacite.type] ?? `✴️`} ${capacite.nom}`,
        tip: `Capacité de boss — ${capacite.nom} : ${capacite.desc ?? ``}`,
        classe: `capacite`,
      });
    }
  }
  for (const affixe of combattant.affixesPortes ?? []) {
    if (combattant.pvActuels > 0) {
      badges.push({
        texte: `${affixe.icone} ${affixe.nom}`,
        tip: `${affixe.nom} : ${affixe.desc}.`,
      });
    }
  }
  return badges;
}
/** Une frappe vient-elle d'être préparée (pour l'effet à l'écran) ? */
export const enConcentration = (combattant) => !!combattant.capaciteEnCharge;
