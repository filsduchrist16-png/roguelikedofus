// Aides à la gestion de l'inventaire : comparer un objet à celui porté, regrouper les doublons.
import { CLASSES, EQUIPEMENTS } from "../data/index.js";
import { STAT_PAR_ELEMENT } from "./progression.js";
import { bonusEquipement, emplacementCible, equiperObjet, peutEquiper, pvMaxPerso } from "./run.js";

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
  `retire`,
  `toile`,
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
export function comparerObjet(inst, perso, emplacement) {
  const def = EQUIPEMENTS[inst.id];
  const slot = emplacement ?? (def ? emplacementCible(perso, inst) : undefined);
  const actuel = slot ? perso.equipement[slot] : undefined;
  if (!slot || !peutEquiper(perso, inst.id)) {
    return { actuel, deltas: [], verdict: `impossible`, emplacement: slot };
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
  return { actuel, deltas, verdict, emplacement: slot };
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

/**
 * Équipe automatiquement, sur chaque héros, les objets de l'inventaire qui sont une nette
 * amélioration (verdict « mieux » : que des gains utiles, aucun effet spécial perdu). Le meilleur
 * gain d'abord, jusqu'à ce qu'il n'y en ait plus. Renvoie le nombre d'objets équipés.
 */
export function equiperMeilleur(run, persos = run.persos) {
  let n = 0;
  for (let tour = 0; tour < 64; tour++) {
    let meilleur = null;
    run.inventaire.forEach((inst, index) => {
      for (const p of persos) {
        const c = comparerObjet(inst, p);
        if (c.verdict !== `mieux`) {
          continue;
        }
        const gain = c.deltas.filter((d) => d.utile).reduce((a, d) => a + Math.max(0, d.valeur), 0);
        if (!meilleur || gain > meilleur.gain) {
          meilleur = { index, p, gain, emplacement: c.emplacement };
        }
      }
    });
    if (!meilleur) {
      break;
    }
    equiperObjet(run.inventaire, meilleur.p, meilleur.index, meilleur.emplacement);
    n++;
  }
  return n;
}

/** Objets de l'inventaire qui n'améliorent aucun héros (ni nettement, ni en partie). */
export function objetsInutiles(run) {
  return run.inventaire.filter((inst) =>
    run.persos.every((p) =>
      [`moins`, `egal`, `impossible`].includes(comparerObjet(inst, p).verdict),
    ),
  );
}
