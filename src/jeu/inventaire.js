// Aides à la gestion de l'inventaire : comparer un objet à celui porté, regrouper les doublons.
import { CLASSES, EQUIPEMENTS, PANOPLIES } from "../data/index.js";
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

// Un PA passe avant tout : un objet (ou une panoplie qui se complète) qui en donne un de plus est
// préféré à n'importe quel gain de dégâts. Viennent ensuite les dégâts, puis, seulement pour
// départager, la survie (PV, résistances) et les effets spéciaux.
const VALEUR_PA = 1000;
const VALEUR_EFFET = 10;
// « À égalité » : en dessous de cet écart de dégâts, deux équipements se départagent par la survie.
const TOLERANCE_DEGATS = 0.1;
// « Équiper le meilleur » ne fait pas chuter les PV max de plus de cette part, même pour des dégâts.
const CHUTE_PV_MAX = 0.35;

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
    (a, inst) => a + (inst ? effetsSpeciaux(inst.id).length : 0),
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
  return { pa: b.paBonus, off, sec };
}

/** Valeur chiffrée d'un équipement (pour les scores affichés) : PA, puis dégâts, puis survie. */
export function valeurEquipement(perso) {
  const c = cleEquipement(perso);
  return c.pa * VALEUR_PA + c.off + c.sec;
}

// Différence de clés : [PA, dégâts, survie].
const deltaCle = (apres, avant) => [
  apres.pa - avant.pa,
  apres.off - avant.off,
  apres.sec - avant.sec,
];
// Ordre des différences : PA d'abord, puis dégâts (hors égalité), puis survie. > 0 si a est mieux que b.
function comparerDeltas(a, b) {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }
  if (Math.abs(a[1] - b[1]) > TOLERANCE_DEGATS) {
    return a[1] - b[1];
  }
  return a[2] - b[2];
}
const ZERO = [0, 0, 0];
const effetsDe = (perso) =>
  new Set(Object.values(perso.equipement).flatMap((inst) => (inst ? effetsSpeciaux(inst.id) : [])));

/**
 * Le changement d'équipement `avant` → `apres` est-il un vrai progrès ? Plus de PA, ou à PA égaux
 * plus de dégâts, ou à dégâts égaux plus de survie. Refusé s'il fait perdre un effet spécial ou
 * s'il écroule les PV max (plus d'un tiers).
 */
export function estProgres(avant, apres, cleAvant = cleEquipement(avant)) {
  if (comparerDeltas(deltaCle(cleEquipement(apres), cleAvant), ZERO) <= 0) {
    return false;
  }
  const anciens = effetsDe(avant);
  const nouveaux = effetsDe(apres);
  if ([...anciens].some((k) => !nouveaux.has(k))) {
    return false;
  }
  return pvMaxPerso(apres) >= pvMaxPerso(avant) * (1 - CHUTE_PV_MAX);
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
  const offensif = Math.round((cleEquipement(essai).off - cleEquipement(perso).off) * 10) / 10;
  const resultat = { actuel, deltas, verdict, emplacement: slot, score, offensif };
  if (verdict === `mitige`) {
    resultat.tendance = score > 0 ? `plus` : `moins`;
  }
  // « sure » : ce que « Équiper le meilleur » ferait d'office (c'est aussi ce que montrent les ▲)
  resultat.sure = verdict !== `impossible` && estProgres(perso, essai);
  return resultat;
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

const RANG_RARETE = [`commun`, `rare`, `epique`, `legendaire`];
const copiePerso = (p) => ({ ...p, equipement: { ...p.equipement } });

// Meilleur coup possible : un seul objet, ou plusieurs pièces d'une même panoplie d'un coup (pour
// qu'une panoplie qui se complète compte autant qu'un gain direct, même si la première pièce seule
// ne vaut rien). Renvoie { perso, actions: [{ inst, emplacement }], delta } ou null.
function meilleurCoup(inventaire, persos) {
  let meilleur = null;
  let base = null;
  const proposer = (perso, actions, apres) => {
    if (!estProgres(perso, apres, base)) {
      return;
    }
    const delta = deltaCle(cleEquipement(apres), base);
    if (!meilleur || comparerDeltas(delta, meilleur.delta) > 0) {
      meilleur = { perso, actions, delta };
    }
  };
  for (const perso of persos) {
    base = cleEquipement(perso);
    // un seul objet
    for (const inst of inventaire) {
      if (!peutEquiper(perso, inst.id)) {
        continue;
      }
      const emplacement = emplacementCible(perso, inst);
      if (emplacement) {
        proposer(perso, [{ inst, emplacement }], {
          ...perso,
          equipement: { ...perso.equipement, [emplacement]: inst },
        });
      }
    }
    // plusieurs pièces d'une panoplie : toutes celles de l'inventaire qui manquent au héros
    for (const nom of Object.keys(PANOPLIES)) {
      // il faut au moins deux pièces de la panoplie dans l'inventaire (sinon ce sont des objets seuls)
      const manquantes = PANOPLIES[nom].pieces.filter((id) => inventaire.some((i) => i.id === id));
      if (manquantes.length < 2) {
        continue;
      }
      const essai = copiePerso(perso);
      const actions = [];
      const pris = new Set();
      for (const id of PANOPLIES[nom].pieces) {
        if (Object.values(essai.equipement).some((i) => i?.id === id) || !peutEquiper(perso, id)) {
          continue;
        }
        const candidats = inventaire.filter((i) => i.id === id && !pris.has(i));
        const inst = candidats.sort(
          (x, y) => RANG_RARETE.indexOf(y.rarete) - RANG_RARETE.indexOf(x.rarete),
        )[0];
        const emplacement = inst && emplacementCible(essai, inst);
        if (emplacement) {
          essai.equipement[emplacement] = inst;
          pris.add(inst);
          actions.push({ inst, emplacement });
        }
      }
      if (actions.length >= 2) {
        proposer(perso, actions, essai);
      }
    }
  }
  return meilleur;
}

function jouerCoups(run, persos, enregistrer) {
  let n = 0;
  for (let tour = 0; tour < 64; tour++) {
    const coup = meilleurCoup(run.inventaire, persos);
    if (!coup) {
      break;
    }
    for (const { inst, emplacement } of coup.actions) {
      const index = run.inventaire.indexOf(inst);
      const remplace = coup.perso.equipement[emplacement];
      equiperObjet(run.inventaire, coup.perso, index, emplacement);
      if (coup.perso.equipement[emplacement] === inst) {
        n++;
        enregistrer?.({ perso: coup.perso, emplacement, inst, remplace });
      }
    }
  }
  return n;
}

/**
 * Équipe automatiquement le meilleur équipement. Les PA passent avant tout (objets à PA, panoplie
 * qui se complète), puis les dégâts (éléments de la classe, Intelligence, critique, arme) ; la
 * survie (PV, résistances) ne sert qu'à départager. Un objet seul ou plusieurs pièces d'une même
 * panoplie sont jugés pareil, le plus gros progrès d'abord, jusqu'à ce qu'il n'y en ait plus.
 * Jamais au prix d'un effet spécial ni d'une chute des PV max de plus d'un tiers.
 * Renvoie le nombre d'objets équipés.
 */
export function equiperMeilleur(run, persos = run.persos) {
  return jouerCoups(run, persos);
}

/**
 * Ce que ferait equiperMeilleur, sans rien changer : [{ perso, emplacement, inst, remplace }] dans
 * l'ordre. Sert au bouton (nombre), aux flèches ▲ et à l'écran de butin : ils ne se contredisent jamais.
 */
export function planEquiper(run, persos = run.persos) {
  const copie = persos.map(copiePerso);
  const essai = { inventaire: run.inventaire.slice() };
  const coups = [];
  jouerCoups(essai, copie, (c) => coups.push({ ...c, perso: persos[copie.indexOf(c.perso)] }));
  return coups;
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
