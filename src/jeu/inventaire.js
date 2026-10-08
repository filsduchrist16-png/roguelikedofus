// Aides à la gestion de l'inventaire : comparer un objet à celui porté, regrouper les doublons.
import { CLASSES, EQUIPEMENTS } from "../data/index.js";
import { STAT_PAR_ELEMENT } from "./progression.js";
import { bonusEquipement, peutEquiper, pvMaxPerso } from "./run.js";

const STATS = [`force`, `intelligence`, `agilite`, `chance`, `soin`, `prospection`, `crit`];
const ELEMENTS = [`terre`, `feu`, `eau`, `air`];
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
]);
export const effetsSpeciaux = (id) =>
  Object.keys(EQUIPEMENTS[id] ?? {}).filter((k) => !CLES_BASE.has(k));

const degatsMoyensArme = (inst) => {
  const a = inst?.rarete ? EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque : undefined;
  return a ? (a.baseMin + a.baseMax) / 2 : 0;
};

// Une stat compte-t-elle vraiment pour cette classe ? (la Force d'équipement ne sert qu'aux
// dégâts Terre : inutile pour une classe qui ne frappe pas en Terre)
function statUtile(stat, classe) {
  const element = Object.keys(STAT_PAR_ELEMENT).find((el) => STAT_PAR_ELEMENT[el] === stat);
  if (!element) {
    return true;
  }
  // l'Intelligence augmente tous les dégâts, l'Agilité le critique et l'esquive
  return classe.elements.includes(element) || stat === `intelligence` || stat === `agilite`;
}

/**
 * Ce que changerait le fait d'équiper `inst` sur `perso` (à la place de l'objet porté).
 * verdict : `mieux` (que des gains utiles), `moins` (que des pertes), `mitige`, `egal`
 * ou `impossible` (le héros ne peut pas le porter).
 */
export function comparerObjet(inst, perso) {
  const def = EQUIPEMENTS[inst.id];
  const slot = def?.slot;
  const actuel = slot ? perso.equipement[slot] : undefined;
  if (!slot || !peutEquiper(perso, inst.id)) {
    return { actuel, deltas: [], verdict: `impossible` };
  }
  const classe = CLASSES[perso.classeId];
  const essai = { ...perso, equipement: { ...perso.equipement, [slot]: inst } };
  const avant = bonusEquipement(perso);
  const apres = bonusEquipement(essai);
  const deltas = [];
  const ajouter = (cle, valeur, utile = true) => {
    if (valeur) {
      deltas.push({ cle, valeur, utile });
    }
  };
  ajouter(`pv`, pvMaxPerso(essai) - pvMaxPerso(perso));
  ajouter(`pa`, apres.paBonus - avant.paBonus);
  if (slot === `arme`) {
    ajouter(`attaque`, degatsMoyensArme(inst) - degatsMoyensArme(actuel));
  }
  for (const stat of STATS) {
    ajouter(stat, (apres.stats[stat] ?? 0) - (avant.stats[stat] ?? 0), statUtile(stat, classe));
  }
  for (const el of ELEMENTS) {
    ajouter(
      `res_${el}`,
      Math.round(((apres.resistances[el] ?? 0) - (avant.resistances[el] ?? 0)) * 100),
    );
  }
  const utiles = deltas.filter((d) => d.utile);
  const gains = utiles.some((d) => d.valeur > 0);
  const pertes = utiles.some((d) => d.valeur < 0);
  let verdict = gains && !pertes ? `mieux` : pertes && !gains ? `moins` : gains ? `mitige` : `egal`;
  // un effet spécial gagné ou perdu (riposte, renaissance…) rend la comparaison discutable
  const nouveaux = effetsSpeciaux(inst.id);
  const anciens = actuel ? effetsSpeciaux(actuel.id) : [];
  const gagnes = nouveaux.some((k) => !anciens.includes(k));
  const perdus = anciens.some((k) => !nouveaux.includes(k));
  if ((verdict === `mieux` && perdus) || ((verdict === `moins` || verdict === `egal`) && gagnes)) {
    verdict = `mitige`;
  }
  return { actuel, deltas, verdict };
}

// Les héros pour qui cet objet est une nette amélioration.
export function herosAmeliores(inst, persos) {
  return persos.filter((p) => comparerObjet(inst, p).verdict === `mieux`);
}

// Regroupe les exemplaires identiques : [{ inst, indices }] dans l'ordre de première apparition.
const cleObjet = (inst) =>
  JSON.stringify([inst.id, inst.rarete, inst.stats, inst.adaptatif, inst.resistances, inst.pa]);
export function grouperInventaire(inventaire) {
  const groupes = new Map();
  inventaire.forEach((inst, i) => {
    const cle = cleObjet(inst);
    if (!groupes.has(cle)) {
      groupes.set(cle, { inst, indices: [] });
    }
    groupes.get(cle).indices.push(i);
  });
  return [...groupes.values()];
}
