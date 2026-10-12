// Évaluation de l'équipement d'un héros : une seule définition, partagée par l'inventaire
// (comparaisons, « Équiper le meilleur ») et la run (choix de l'anneau à remplacer).
// Import circulaire avec run.js : sans danger, les fonctions de run.js ne sont appelées qu'à l'exécution.
import { CLASSES, EQUIPEMENTS } from "../data/index.js";
import { STAT_PAR_ELEMENT } from "./progression.js";
import { bonusEquipement, pvMaxPerso } from "./run.js";

// Propriétés d'objet qui ne sont pas des stats chiffrées (effets spéciaux).
const CLES_BASE = new Set([
  `id`,
  `nom`,
  `slot`,
  `source`,
  `tiers`,
  `panoplie`,
  `ligneAvant`,
  `secret`,
  `retire`,
  `toile`,
]);
export const effetsSpeciaux = (id) =>
  Object.keys(EQUIPEMENTS[id] ?? {}).filter((cle) => !CLES_BASE.has(cle));
// Effets spéciaux qui comptent comme un avantage. Les autres sont chiffrés ailleurs : paGamble est
// une espérance de PA (négative), comptée dans `pa` de la clé d'équipement.
export const effetsAvantageux = (id) => effetsSpeciaux(id).filter((cle) => cle !== `paGamble`);
// Espérance de PA par tour d'un objet à PA aléatoires (1/3 de +1, 2/3 de −1 : environ −0,33).
const esperancePAGamble = (id) => {
  const gamble = EQUIPEMENTS[id]?.paGamble;
  return gamble ? gamble.pPlus * gamble.plus - (1 - gamble.pPlus) * gamble.moins : 0;
};

export const degatsMoyensArme = (inst) => {
  const attaque = inst?.rarete ? EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque : undefined;
  return attaque ? (attaque.baseMin + attaque.baseMax) / 2 : 0;
};

// Un PA passe avant tout : un objet (ou une panoplie qui se complète) qui en donne un de plus est
// préféré à n'importe quel gain de dégâts. Viennent ensuite les dégâts, puis, seulement pour
// départager, la survie (PV, résistances) et les effets spéciaux.
const VALEUR_PA = 1000;
const VALEUR_EFFET = 10;

/**
 * Clé de comparaison de l'équipement d'un héros : { pa, off, sec }.
 * pa  : PA venant de l'équipement et des panoplies (plafonnés comme dans le jeu).
 * off : dégâts : stat de son meilleur élément (le second à moitié), Intelligence (dégâts
 *       globaux), Agilité, critique (le critique d'abord parmi les stats), dégâts d'arme.
 * sec : survie et effets spéciaux, uniquement pour départager.
 */
export function cleEquipement(perso) {
  const bonus = bonusEquipement(perso);
  const stats = bonus.stats;
  const elements = CLASSES[perso.classeId].elements
    .map((element) => stats[STAT_PAR_ELEMENT[element]] ?? 0)
    .sort((premier, second) => second - premier);
  const res = Object.values(bonus.resistances).reduce((somme, resistance) => somme + resistance, 0);
  const effets = Object.values(perso.equipement).reduce(
    (total, inst) => total + (inst ? effetsAvantageux(inst.id).length : 0),
    0,
  );
  const paAleatoire = Object.values(perso.equipement).reduce(
    (total, inst) => total + (inst ? esperancePAGamble(inst.id) : 0),
    0,
  );
  const off =
    (elements[0] ?? 0) +
    (elements[1] ?? 0) * 0.5 +
    (stats.intelligence ?? 0) * 0.4 +
    (stats.agilite ?? 0) * 0.3 +
    (stats.crit ?? 0) * 2.5 +
    degatsMoyensArme(perso.equipement.arme) * 2;
  const sec = pvMaxPerso(perso) * 0.05 + res * 20 + (stats.soin ?? 0) * 0.1 + effets * VALEUR_EFFET;
  return { pa: bonus.paBonus + paAleatoire, off, sec };
}

/** Valeur chiffrée d'un équipement (pour les scores affichés) : PA, puis dégâts, puis survie. */
export function valeurEquipement(perso) {
  const cle = cleEquipement(perso);
  return cle.pa * VALEUR_PA + cle.off + cle.sec;
}
