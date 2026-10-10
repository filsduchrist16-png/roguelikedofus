// Aides à la gestion de l'inventaire : comparer un objet à celui porté, regrouper les doublons.
import { CLASSES, EQUIPEMENTS } from "../data/index.js";
import { STAT_PAR_ELEMENT } from "./progression.js";
import { bonusEquipement, emplacementCible, equiperObjet, peutEquiper, pvMaxPerso } from "./run.js";
import { PA_MAX_EQUIPEMENT, PA_MAX_PANOPLIES } from "./emplacements.js";
import { bonusPanoplie, compterPanoplies, paliersPanoplie } from "./panoplies.js";
import { PANOPLIES } from "../data/index.js";

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

// Libellés courts des effets spéciaux, pour les comparaisons (« − riposte »).
export const NOMS_EFFETS = {
  multKamas: `kamas ×`,
  esquiveParPiece: `esquive par pièce`,
  retraitPA: `retrait de PA`,
  recupPASort: `récup. de PA`,
  esquiveArriere: `esquive (arrière)`,
  renaissance: `renaissance`,
  bouclierDebut: `bouclier de départ`,
  esquiveBonus: `esquive`,
  prospParPvManquant: `prospection / PV manquant`,
  paGamble: `PA aléatoires`,
  perceResistances: `perce-résistances`,
  changeLigne: `changement de ligne`,
  soinDegatsRecus: `récup. des dégâts subis`,
  assome: `assommer`,
  elementLibre: `élément libre`,
  frappeDerriere: `frappe derrière`,
  soinAllieBlesse: `soin d'allié`,
  riposteAvant: `riposte`,
  poisonArme: `poison`,
};
export const nomEffet = (cle) => NOMS_EFFETS[cle] ?? cle;

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

// Valeur d'un effet spécial dans le score (riposte, renaissance… : environ une demi-pièce).
const VALEUR_EFFET = 30;
// Un PA vaut plus que n'importe quelle pièce : c'est ce qui fait pencher la balance en premier.
const VALEUR_PA = 150;

/**
 * Avancée vers un palier de panoplie qui donne du PA (pas encore atteint, et tant que le plafond
 * de PA n'est pas touché) : une pièce de plus sur 3 vaut un tiers d'un demi-PA, etc. Sans cela, une
 * pièce de panoplie à moitié inutile ne serait jamais équipée, et le palier n'arriverait jamais.
 */
function progressionPA(perso, paBonus) {
  const comptes = compterPanoplies(perso);
  let pasDePanoplie = paBonus >= PA_MAX_EQUIPEMENT;
  let meilleur = 0;
  for (const [nom, nb] of Object.entries(comptes)) {
    if (bonusPanoplie(nom, nb)?.pa) {
      pasDePanoplie ||= PA_MAX_PANOPLIES <= 1;
      continue;
    }
    const cible = paliersPanoplie(nom).find((k) => k > nb && PANOPLIES[nom].paliers[k].pa);
    if (cible) {
      meilleur = Math.max(meilleur, nb / cible);
    }
  }
  return pasDePanoplie ? 0 : VALEUR_PA * 0.5 * meilleur;
}

/**
 * Valeur chiffrée de l'équipement d'un héros, alignée sur les règles d'utilité de comparerObjet.
 * Ce qui compte d'abord : les PA (objets ou panoplie qui se complète) puis les dégâts : stats des
 * éléments de la classe (la meilleure à plein, la seconde à moitié), Intelligence (dégâts globaux),
 * dégâts d'arme, critique. Viennent ensuite, en poids plus faible : PV, soin, résistances et
 * effets spéciaux.
 */
export function valeurEquipement(perso, offensifSeul = false) {
  const b = bonusEquipement(perso);
  const s = b.stats;
  const elements = CLASSES[perso.classeId].elements
    .map((x) => s[STAT_PAR_ELEMENT[x]] ?? 0)
    .sort((x, y) => y - x);
  const res = Object.values(b.resistances).reduce((a, v) => a + v, 0);
  const effets = Object.values(perso.equipement).reduce(
    (a, inst) => a + (inst ? effetsSpeciaux(inst.id).length : 0),
    0,
  );
  const offensif =
    (elements[0] ?? 0) +
    (elements[1] ?? 0) * 0.5 +
    (s.intelligence ?? 0) * 0.4 +
    (s.agilite ?? 0) * 0.3 +
    (s.crit ?? 0) * 2.5 +
    degatsMoyensArme(perso.equipement.arme) * 2 +
    b.paBonus * VALEUR_PA +
    progressionPA(perso, b.paBonus);
  if (offensifSeul) {
    return offensif;
  }
  return (
    offensif + pvMaxPerso(perso) * 0.2 + (s.soin ?? 0) * 0.4 + res * 80 + effets * VALEUR_EFFET
  );
}

/**
 * Ce que changerait le fait d'équiper `inst` sur `perso` (à la place de l'objet porté).
 * verdict : `mieux` (que des gains utiles), `moins` (que des pertes), `mitige`, `egal`
 * ou `impossible` (le héros ne peut pas le porter).
 * score : gain chiffré (valeurPerso après − avant) ; tendance (`plus`/`moins`) pour un mitigé.
 * Les effets spéciaux gagnés ou perdus figurent dans les deltas (cle `effet_<nom>`, ±1).
 */
export function comparerObjet(inst, perso, emplacement) {
  const def = EQUIPEMENTS[inst.id];
  const slot = emplacement ?? (def ? emplacementCible(perso, inst) : undefined);
  const actuel = slot ? perso.equipement[slot] : undefined;
  if (!slot || !peutEquiper(perso, inst.id)) {
    return { actuel, deltas: [], verdict: `impossible`, emplacement: slot, score: 0 };
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
  for (const k of nouveaux.filter((k) => !anciens.includes(k))) {
    ajouter(`effet_${k}`, 1);
  }
  for (const k of anciens.filter((k) => !nouveaux.includes(k))) {
    ajouter(`effet_${k}`, -1);
  }
  const score = Math.round(valeurEquipement(essai) - valeurEquipement(perso));
  const offensif =
    Math.round((valeurEquipement(essai, true) - valeurEquipement(perso, true)) * 10) / 10;
  const resultat = { actuel, deltas, verdict, emplacement: slot, score, offensif };
  if (verdict === `mitige`) {
    resultat.tendance = score > 0 ? `plus` : `moins`;
  }
  return resultat;
}

// Les héros pour qui cet objet est une nette amélioration.
export function herosAmeliores(inst, persos) {
  return persos.filter((p) => comparerObjet(inst, p).verdict === `mieux`);
}

// Amélioration sûre à équiper d'office : le score augmente vraiment (PA d'abord, puis dégâts), ou
// l'objet n'a que des gains. Jamais au prix d'un effet spécial perdu.
function ameliorationSure(c) {
  const perdEffet = c.deltas.some((d) => d.cle.startsWith(`effet_`) && d.valeur < 0);
  // PA et dégâts décident : jamais d'échange qui en fait perdre, même contre beaucoup de PV
  return (
    !perdEffet &&
    c.offensif >= 0 &&
    (c.verdict === `mieux` || (c.verdict !== `impossible` && c.score > 0.5))
  );
}

/** Les héros pour qui équiper cet objet est sûrement un progrès (voir equiperMeilleur). */
export function herosAmeliorablesAuto(inst, persos) {
  return persos.filter((p) => ameliorationSure(comparerObjet(inst, p)));
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
 * Équipe automatiquement, sur chaque héros, les objets de l'inventaire qui sont un progrès sûr
 * (nette amélioration, ou « plutôt mieux » sans effet spécial perdu). Le plus gros gain d'abord,
 * jusqu'à ce qu'il n'y en ait plus. Renvoie le nombre d'objets équipés.
 */
export function equiperMeilleur(run, persos = run.persos) {
  let n = 0;
  for (let tour = 0; tour < 64; tour++) {
    let meilleur = null;
    run.inventaire.forEach((inst, index) => {
      for (const p of persos) {
        const c = comparerObjet(inst, p);
        if (!ameliorationSure(c) || (meilleur && c.score <= meilleur.score)) {
          continue;
        }
        meilleur = { index, p, score: c.score, emplacement: c.emplacement };
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

// L'objet n'apporte rien à ce héros : moins bien, pareil, impossible, ou mitigé à score négatif.
export function inutilePour(inst, perso) {
  const c = comparerObjet(inst, perso);
  return (
    [`moins`, `egal`, `impossible`].includes(c.verdict) || (c.verdict === `mitige` && c.score <= 0)
  );
}

/** Objets de l'inventaire qui n'améliorent aucun héros (ni nettement, ni « plutôt mieux »). */
export function objetsInutiles(run) {
  return run.inventaire.filter((inst) => run.persos.every((p) => inutilePour(inst, p)));
}
