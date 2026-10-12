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
  Object.keys(EQUIPEMENTS[id] ?? {}).filter((k) => !CLES_BASE.has(k));
// Effets spéciaux qui comptent comme un avantage. Les autres sont chiffrés ailleurs : paGamble est
// une espérance de PA (négative), comptée dans `pa` de la clé d'équipement.
export const effetsAvantageux = (id) => effetsSpeciaux(id).filter((k) => k !== `paGamble`);
// Espérance de PA par tour d'un objet à PA aléatoires (1/3 de +1, 2/3 de −1 : environ −0,33).
const esperancePAGamble = (id) => {
  const g = EQUIPEMENTS[id]?.paGamble;
  return g ? g.pPlus * g.plus - (1 - g.pPlus) * g.moins : 0;
};

export const degatsMoyensArme = (inst) => {
  const a = inst?.rarete ? EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque : undefined;
  return a ? (a.baseMin + a.baseMax) / 2 : 0;
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
  const b = bonusEquipement(perso);
  const s = b.stats;
  const elements = CLASSES[perso.classeId].elements
    .map((x) => s[STAT_PAR_ELEMENT[x]] ?? 0)
    .sort((x, y) => y - x);
  const res = Object.values(b.resistances).reduce((a, v) => a + v, 0);
  const effets = Object.values(perso.equipement).reduce(
    (a, inst) => a + (inst ? effetsAvantageux(inst.id).length : 0),
    0,
  );
  const paAleatoire = Object.values(perso.equipement).reduce(
    (a, inst) => a + (inst ? esperancePAGamble(inst.id) : 0),
    0,
  );
  const off =
    (elements[0] ?? 0) +
    (elements[1] ?? 0) * 0.5 +
    (s.intelligence ?? 0) * 0.4 +
    (s.agilite ?? 0) * 0.3 +
    (s.crit ?? 0) * 2.5 +
    degatsMoyensArme(perso.equipement.arme) * 2;
  const sec = pvMaxPerso(perso) * 0.05 + res * 20 + (s.soin ?? 0) * 0.1 + effets * VALEUR_EFFET;
  return { pa: b.paBonus + paAleatoire, off, sec };
}

/** Valeur chiffrée d'un équipement (pour les scores affichés) : PA, puis dégâts, puis survie. */
export function valeurEquipement(perso) {
  const c = cleEquipement(perso);
  return c.pa * VALEUR_PA + c.off + c.sec;
}
