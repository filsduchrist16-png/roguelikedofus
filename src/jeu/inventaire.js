// Aides à la gestion de l'inventaire : comparer un objet à celui porté, regrouper les doublons.
import { CLASSES, EQUIPEMENTS, PANOPLIES } from "../data/index.js";
import { STAT_PAR_ELEMENT } from "./progression.js";
import {
  bonusEquipement,
  emplacementCible,
  emplacementPossible,
  equiperObjet,
  peutEquiper,
  pvMaxPerso,
} from "./run.js";
import { EMPLACEMENTS, emplacementsDuType, typeDeEmplacement } from "./emplacements.js";

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
// Effets spéciaux qui comptent comme un avantage. Les autres sont chiffrés ailleurs : paGamble est
// une espérance de PA (négative), comptée dans `pa` de la clé d'équipement.
const effetsAvantageux = (id) => effetsSpeciaux(id).filter((k) => k !== `paGamble`);
// Espérance de PA par tour d'un objet à PA aléatoires (1/3 de +1, 2/3 de −1 : environ −0,33).
const esperancePAGamble = (id) => {
  const g = EQUIPEMENTS[id]?.paGamble;
  return g ? g.pPlus * g.plus - (1 - g.pPlus) * g.moins : 0;
};

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
  new Set(
    Object.values(perso.equipement).flatMap((inst) => (inst ? effetsAvantageux(inst.id) : [])),
  );

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
const rang = (inst) => RANG_RARETE.indexOf(inst.rarete);

// Le chargement `a` (sa clé) est-il meilleur que `b` ? PA, puis dégâts, puis survie.
const meilleureCle = (a, b) => comparerDeltas(deltaCle(a, b), ZERO) > 0;

// Un chargement est valide s'il ne fait perdre aucun effet spécial ni ne vide les PV max (voir estProgres).
function chargementValide(origine, effetsOrigine, pvOrigine, essai) {
  const effets = effetsDe(essai);
  return (
    [...effetsOrigine].every((k) => effets.has(k)) &&
    pvMaxPerso(essai) >= pvOrigine * (1 - CHUTE_PV_MAX)
  );
}

/**
 * Améliore un chargement emplacement par emplacement (les `verrous` ne bougent pas) en testant tous
 * les objets disponibles, jusqu'à ce que plus aucun changement d'un seul objet n'aide.
 */
function grimper(perso, depart, verrous, pool, contexte) {
  const parType = contexte.parType;
  let eq = { ...depart };
  let cle = cleEquipement({ ...perso, equipement: eq });
  for (let tour = 0; tour < 12; tour++) {
    let ameliore = false;
    for (const slot of EMPLACEMENTS) {
      if (verrous.has(slot)) {
        continue;
      }
      for (const inst of parType[typeDeEmplacement(slot)] ?? []) {
        if (Object.values(eq).includes(inst)) {
          continue;
        }
        if (
          !peutEquiper(perso, inst.id) ||
          !emplacementPossible({ ...perso, equipement: eq }, inst, slot)
        ) {
          continue;
        }
        const essai = { ...perso, equipement: { ...eq, [slot]: inst } };
        if (!chargementValide(perso, contexte.effets, contexte.pv, essai)) {
          continue;
        }
        const c = cleEquipement(essai);
        if (meilleureCle(c, cle)) {
          eq = essai.equipement;
          cle = c;
          ameliore = true;
        }
      }
    }
    if (!ameliore) {
      break;
    }
  }
  return { eq, cle };
}

// Point de départ qui force toutes les pièces d'une panoplie disponibles (portées ou dans l'inventaire).
// Renvoie { eq, verrous, nouvelles } ou null s'il n'y a aucune pièce à ajouter.
function departForce(perso, depart, verrousDepart, inventaire, nom) {
  const eq = { ...depart };
  const verrous = new Set(verrousDepart);
  let nouvelles = 0;
  for (const id of PANOPLIES[nom].pieces) {
    const porte = Object.entries(eq).find(([, i]) => i?.id === id);
    if (porte) {
      verrous.add(porte[0]);
      continue;
    }
    const inst = inventaire
      .filter((i) => i.id === id && !Object.values(eq).includes(i))
      .sort((x, y) => rang(y) - rang(x))[0];
    if (!inst || !peutEquiper(perso, id)) {
      continue;
    }
    const libres = emplacementsDuType(EQUIPEMENTS[id].slot).filter((k) => !verrous.has(k));
    const cible = emplacementCible({ ...perso, equipement: eq }, inst);
    const slot = libres.includes(cible) ? cible : libres[0];
    if (!slot) {
      continue;
    }
    eq[slot] = inst;
    verrous.add(slot);
    nouvelles++;
  }
  return nouvelles ? { eq, verrous } : null;
}

/**
 * Meilleur chargement complet d'un héros parmi tout ce qui est disponible (porté + inventaire) :
 * on part de l'équipement actuel, puis de chaque panoplie dont on peut mettre plusieurs pièces d'un
 * coup (et des paires de panoplies), en forçant ces pièces et en cherchant le meilleur pour les
 * autres emplacements. Renvoie { eq, cle } ou null si rien ne vaut mieux que l'actuel.
 */
function meilleurChargement(perso, inventaire) {
  const pool = [...inventaire, ...Object.values(perso.equipement)];
  // panoplies jouables : au moins deux pièces disponibles dont une dans l'inventaire
  const disponible = (nom) =>
    PANOPLIES[nom].pieces.filter((id) => pool.some((i) => i.id === id) && peutEquiper(perso, id));
  const jouables = Object.keys(PANOPLIES).filter(
    (nom) =>
      disponible(nom).length >= 2 &&
      PANOPLIES[nom].pieces.some((id) => inventaire.some((i) => i.id === id)),
  );
  const piecesJouables = new Set(jouables.flatMap((nom) => PANOPLIES[nom].pieces));
  // par type d'objet : les objets portés, les pièces des panoplies jouables et les 4 meilleurs
  // objets seuls (les autres ne peuvent pas faire partie d'un meilleur ensemble)
  const parType = {};
  for (const inst of pool) {
    const type = EQUIPEMENTS[inst.id]?.slot;
    if (type && peutEquiper(perso, inst.id)) {
      (parType[type] ??= []).push(inst);
    }
  }
  for (const [type, liste] of Object.entries(parType)) {
    const slot = emplacementsDuType(type)[0];
    const notes = new Map(
      liste.map((inst) => [
        inst,
        cleEquipement({ ...perso, equipement: { ...perso.equipement, [slot]: inst } }),
      ]),
    );
    const classes = [...liste].sort((x, y) =>
      meilleureCle(notes.get(x), notes.get(y))
        ? -1
        : meilleureCle(notes.get(y), notes.get(x))
          ? 1
          : 0,
    );
    const gardes = new Set(classes.slice(0, 4));
    parType[type] = liste.filter(
      (inst) =>
        gardes.has(inst) ||
        piecesJouables.has(inst.id) ||
        Object.values(perso.equipement).includes(inst),
    );
  }
  const contexte = { effets: effetsDe(perso), pv: pvMaxPerso(perso), parType };
  const aucun = new Set();
  const departs = [grimper(perso, perso.equipement, aucun, pool, contexte)];
  const seuls = [];
  for (const nom of jouables) {
    const d = departForce(perso, perso.equipement, aucun, inventaire, nom);
    if (d) {
      const r = grimper(perso, d.eq, d.verrous, pool, contexte);
      departs.push(r);
      seuls.push({ nom, r });
    }
  }
  // paires de panoplies, parmi les 4 meilleures prises seules
  seuls.sort((x, y) =>
    meilleureCle(x.r.cle, y.r.cle) ? -1 : meilleureCle(y.r.cle, x.r.cle) ? 1 : 0,
  );
  const top = seuls.slice(0, 3);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = departForce(perso, perso.equipement, aucun, inventaire, top[i].nom);
      const b = a && departForce(perso, a.eq, a.verrous, inventaire, top[j].nom);
      if (b) {
        departs.push(grimper(perso, b.eq, b.verrous, pool, contexte));
      }
    }
  }
  let meilleur = departs[0];
  for (const d of departs) {
    if (meilleureCle(d.cle, meilleur.cle)) {
      meilleur = d;
    }
  }
  const actuel = cleEquipement(perso);
  return meilleureCle(meilleur.cle, actuel) ? meilleur : null;
}

// Les équipements à poser pour atteindre le chargement : [{ inst, emplacement }] dans un ordre jouable.
function actionsVers(perso, inventaire, eq) {
  const restant = EMPLACEMENTS.filter((k) => eq[k] && eq[k] !== perso.equipement[k]);
  const actions = [];
  const simule = copiePerso(perso);
  const stock = inventaire.slice();
  for (let passe = 0; passe < 4 && restant.length; passe++) {
    for (const slot of [...restant]) {
      const inst = eq[slot];
      if (stock.includes(inst)) {
        actions.push({ inst, emplacement: slot });
        stock.splice(stock.indexOf(inst), 1);
        const remplace = simule.equipement[slot];
        if (remplace) {
          stock.push(remplace);
        }
        simule.equipement[slot] = inst;
        restant.splice(restant.indexOf(slot), 1);
      }
    }
  }
  return actions;
}

function jouerCoups(run, persos, enregistrer) {
  let n = 0;
  for (let tour = 0; tour < 24; tour++) {
    let meilleur = null;
    for (const perso of persos) {
      const c = meilleurChargement(perso, run.inventaire);
      if (!c) {
        continue;
      }
      const delta = deltaCle(c.cle, cleEquipement(perso));
      if (!meilleur || comparerDeltas(delta, meilleur.delta) > 0) {
        meilleur = { perso, c, delta };
      }
    }
    if (!meilleur) {
      break;
    }
    const actions = actionsVers(meilleur.perso, run.inventaire, meilleur.c.eq);
    let fait = 0;
    for (const { inst, emplacement } of actions) {
      const index = run.inventaire.indexOf(inst);
      const remplace = meilleur.perso.equipement[emplacement];
      equiperObjet(run.inventaire, meilleur.perso, index, emplacement);
      if (meilleur.perso.equipement[emplacement] === inst) {
        fait++;
        enregistrer?.({ perso: meilleur.perso, emplacement, inst, remplace });
      }
    }
    if (!fait) {
      break;
    }
    n += fait;
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
const idsInstances = new WeakMap();
let prochainId = 1;
const idDe = (x) => {
  if (!x) {
    return 0;
  }
  if (!idsInstances.has(x)) {
    idsInstances.set(x, prochainId++);
  }
  return idsInstances.get(x);
};
let memo = { cle: ``, plan: [] };
export function planEquiper(run, persos = run.persos) {
  // même inventaire, mêmes pièces portées, mêmes niveaux : même plan (l'écran se redessine souvent)
  const cle = JSON.stringify([
    run.inventaire.map(idDe),
    persos.map((p) => [
      p.classeId,
      p.position,
      p.progression?.niveau,
      EMPLACEMENTS.map((k) => idDe(p.equipement[k])),
    ]),
  ]);
  if (memo.cle === cle && memo.persos?.every((p, i) => p === persos[i])) {
    return memo.plan;
  }
  const copie = persos.map(copiePerso);
  const essai = { inventaire: run.inventaire.slice() };
  const coups = [];
  jouerCoups(essai, copie, (c) => coups.push({ ...c, perso: persos[copie.indexOf(c.perso)] }));
  memo = { cle, plan: coups, persos: persos.slice() };
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
