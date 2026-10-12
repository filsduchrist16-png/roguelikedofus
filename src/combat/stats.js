import { filtrerCiblesClasse, multiplicateurClasse, sortIndisponible } from "./classes.js";
import { SORTS } from "../data/index.js";
import {
  bonusDegatsIntelligence,
  multiplicateurDofusDegats,
  multiplicateurSoin,
  multiplicateurStat,
  statElement,
} from "../jeu/progression.js";
import { caseLibreSurLigne, caseOpposeeLibre, membresRangee } from "./effets.js";
import { lancerAttaque } from "./sorts.js";
export const tirageEntier = (e, t, n) => e + Math.floor(n() * (t - e + 1));
export const vivants = (e) => e.filter((e) => e.pvActuels > 0);
export const trouverParRef = (e, t) => e.find((e) => e.ref === t);
export const reliquesActivesDe = (e, t) => {
  if (e.camp === `joueur`) {
    return t.reliquesActives ?? new Set();
  }
  return new Set();
};
export const ennemisVivants = (e, t) => vivants(t).filter((t) => t.camp !== e.camp);
export const alliesVivants = (e, t) =>
  vivants(t).filter((t) => t.camp === e.camp && !t.estLance && !t.estInvocation);
export const ELEMENTS = [`terre`, `feu`, `eau`, `air`];
export const sommeEffets = (e, t) =>
  e.effets.filter((e) => e.stat === t).reduce((acc, item) => acc + item.valeur, 0);
const STATS_ELEMENTAIRES = [`force`, `intelligence`, `agilite`, `chance`];
export function statsEffectives(e) {
  let t = {
    ...e.stats,
  };
  for (let n of STATS_ELEMENTAIRES) {
    let r = sommeEffets(e, n);
    if (r) {
      t[n] = (t[n] ?? 0) + r;
    }
  }
  let n = sommeEffets(e, `crit`);
  if (n) {
    t.crit = (t.crit ?? 0) + n;
  }
  return t;
}
function elementsDominants(e) {
  if (e.elements) {
    return e.elements;
  }
  let t = statsEffectives(e);
  let n = ELEMENTS.map((e) => [e, statElement(t, e)]).sort((e, t) => t[1] - e[1]);
  return [n[0][0], n[1][0]];
}
export function elementsUtilisables(e) {
  if (e.elementLibre) {
    return ELEMENTS;
  }
  return elementsDominants(e);
}
export function meilleurElement(e) {
  let t = statsEffectives(e);
  return elementsUtilisables(e).reduce((acc, item) => {
    if (statElement(t, item) > statElement(t, acc)) {
      return item;
    }
    return acc;
  });
}
export const multiplicateurSoinDe = (e) =>
  multiplicateurSoin(e.stats, statElement(statsEffectives(e), meilleurElement(e)));
export const enLigneAvant = (e) => e.position < 4;
export function chanceEsquive(e, t) {
  let n = statsEffectives(e);
  let r = t?.sansBonusPosition
    ? 0
    : (e.esquiveBonus ?? 0) + (enLigneAvant(e) ? 0 : (e.esquiveArriere ?? 0));
  let i = e.effets
    .filter((e) => e.stat === `esquive` && !(t?.sansViaBrume && e.viaBrume))
    .reduce((acc, item) => acc + item.valeur, 0);
  // rendement décroissant : l'Agilité seule plafonne à 35 % (les bonus d'effets s'ajoutent avant)
  let ag = Math.max(0, n.agilite ?? 0);
  let a = ag / (ag + 400) + i + r;
  if (t?.sansPlafond) {
    return a;
  }
  return Math.min(0.35, a);
}
export function coutPA(e, t) {
  let n = t.remisesCout?.[e.id] ?? 0;
  if (n > 0) {
    return Math.max(1, e.coutPA - n);
  }
  return e.coutPA;
}
function filtrerLigneAvant(e) {
  let t = e.filter(enLigneAvant);
  if (t.length) {
    return t;
  }
  return e;
}
const enCooldownSurCible = (e, t, ref) => (e.cooldowns[`${t.id}:${ref}`] ?? 0) > 0;
const enCooldown = (e, t) => !!t.cooldownTours && (e.cooldowns[t.id] ?? 0) > 0;
export function ciblesValides(e, t, n) {
  let r = n.filter((e) => !e.estEgide);
  let i;
  switch (t.cible) {
    case `soi`:
      i = [e];
      break;
    case `allie`:
    case `allie_tous`:
      i = alliesVivants(e, r);
      break;
    case `ennemi_tous`:
      i = ennemisVivants(e, r).filter((x) => !x.estLance);
      break;
    case `ennemi_ligne`: {
      // la Lance du Forgelance n'est pas une cible (et ne masque pas la ligne arrière)
      let t = ennemisVivants(e, r).filter((x) => !x.estLance);
      i = sommeEffets(e, `ignoreLigne`) > 0 ? t : filtrerLigneAvant(t);
      break;
    }
    case `mixte`:
      i = vivants(r);
      break;
  }
  if (e.camp === `ennemi`) {
    let e = i.filter((e) => e.camp === `joueur` && e.provoque && e.pvActuels > 0);
    if (e.length) {
      i = e;
    }
  }
  if (t.zoneLance) {
    let t = vivants(n).find((t) => t.estLance && t.lanceurRef === e.ref);
    if (t && !i.some((e) => e.ref === t.ref)) {
      i = [...i, t];
    }
  }
  if (
    (t.cible === `ennemi_tous` || t.cible === `ennemi_ligne` || t.cible === `mixte`) &&
    sommeEffets(e, `tetanise`) > 0 &&
    sommeEffets(e, `ignoreLigne`) <= 0
  ) {
    i = i.filter((t) => t.camp === e.camp || enLigneAvant(t));
  }
  if (
    (t.type === `buff` &&
      t.effetRangeeAlliee &&
      !membresRangee(e, t.effetRangeeAlliee, n).length) ||
    (t.consommeRage && !(e.rage ?? 0)) ||
    (t.pasPremierTour && (e.toursJoues ?? 0) <= 1) ||
    (t.posePortail && (e.portails ?? 0) >= 4) ||
    (t.kaboom && !ennemisVivants(e, n).some((e) => (e.bombes ?? 0) > 0)) ||
    (t.invoqueLance && vivants(n).some((t) => t.ref === `lance_${e.ref}`)) ||
    (t.rappelleLance && !vivants(n).some((t) => t.ref === `lance_${e.ref}`)) ||
    (t.invoqueEgide && vivants(n).some((t) => t.ref === `egide_${e.ref}`)) ||
    (t.invoqueEgide &&
      (i = i.filter((t) => caseLibreSurLigne(e.camp, enLigneAvant(t), n) !== null)),
    t.changeLigne && caseOpposeeLibre(e, n) === null) ||
    enCooldown(e, t) ||
    sortIndisponible(e, t, n) ||
    (t.cooldown && (i = i.filter((n) => !enCooldownSurCible(e, t, n.ref))),
    t.maxParTour && (e.lancersCeTour?.[t.id] ?? 0) >= t.maxParTour)
  ) {
    return [];
  }
  if (t.maxParCibleParTour) {
    i = i.filter((n) => (e.lancersCeTour?.[`${t.id}:${n.ref}`] ?? 0) < t.maxParCibleParTour);
  }
  return filtrerCiblesClasse(e, t, i);
}
// Pourquoi un sort ne peut pas être lancé maintenant : libellé court pour l'interface, ou null.
// Reprend dans l'ordre le coût en PA, la recharge, puis les conditions de ciblesValides.
export function raisonIndisponible(lanceur, sort, combattants) {
  const cout = coutPA(sort, lanceur);
  if (lanceur.paActuels < cout) {
    return `PA : ${lanceur.paActuels}/${cout}`;
  }
  const recharge = lanceur.cooldowns?.[sort.id] ?? 0;
  if (recharge > 0) {
    return `Recharge : ${recharge} t`;
  }
  if (ciblesValides(lanceur, sort, combattants).length > 0) {
    return null;
  }
  const lanceVivante = (ref) => vivants(combattants).some((c) => c.ref === ref);
  const lances = lanceur.lancersCeTour?.[sort.id] ?? 0;
  if (sort.maxParTour && lances >= sort.maxParTour) {
    return `Déjà lancé ce tour (${lances}/${sort.maxParTour})`;
  }
  if (sort.pasPremierTour && (lanceur.toursJoues ?? 0) <= 1) {
    return `Pas au 1er tour`;
  }
  if (sort.consommeRage && !(lanceur.rage ?? 0)) {
    return `Il faut 1 Rage`;
  }
  if (sort.kaboom && !ennemisVivants(lanceur, combattants).some((c) => (c.bombes ?? 0) > 0)) {
    return `Aucune bombe posée`;
  }
  if (sort.invoqueCreature && sortIndisponible(lanceur, sort, combattants)) {
    const deja = vivants(combattants).some(
      (c) => c.ref === `crea_${sort.invoqueCreature}_${lanceur.ref}`,
    );
    return deja ? `Créature déjà invoquée` : `Plus de place pour l'invoquer`;
  }
  if (sort.posePortail && (lanceur.portails ?? 0) >= 4) {
    return `4 portails déjà ouverts`;
  }
  if (sort.invoqueLance && lanceVivante(`lance_${lanceur.ref}`)) {
    return `Lance déjà invoquée`;
  }
  if (sort.rappelleLance && !lanceVivante(`lance_${lanceur.ref}`)) {
    return `Aucune lance à rappeler`;
  }
  if (sort.invoqueEgide && lanceVivante(`egide_${lanceur.ref}`)) {
    return `Égide déjà invoquée`;
  }
  if (sort.changeLigne && caseOpposeeLibre(lanceur, combattants) === null) {
    return `Aucune case libre en face`;
  }
  if (
    sort.type === `buff` &&
    sort.effetRangeeAlliee &&
    !membresRangee(lanceur, sort.effetRangeeAlliee, combattants).length
  ) {
    return `Aucun allié dans la rangée`;
  }
  if (sort.cooldown || sort.maxParCibleParTour) {
    return `Déjà visé sur chaque cible`;
  }
  return `Aucune cible`;
}
export function reinitialiserTour(e) {
  e.lancersCeTour = {};
  e.remisesCout = {};
  e.veilleursRecuCeTour = false;
}
export function multiplicateurRelance(e, t) {
  if (t) {
    return (
      (e.bonusParRelanceCeTour
        ? 1 + e.bonusParRelanceCeTour * Math.max(0, t.lancersCeTour?.[e.id] ?? 0)
        : 1) *
      (e.bonusParLancerCombat
        ? 1 +
          Math.min(
            e.plafondBonusLancerCombat ?? Infinity,
            e.bonusParLancerCombat * Math.max(0, t.lancersCombat?.[e.id] ?? 0),
          )
        : 1)
    );
  }
  return 1;
}
export function ciblesTouchees(e, t, n, r) {
  if (t.zoneLance) {
    if (t.tousSiLanceArriere && n.estLance && !enLigneAvant(n)) {
      return ennemisVivants(e, r);
    }
    let i = enLigneAvant(n);
    return ennemisVivants(e, r).filter((e) => enLigneAvant(e) === i);
  }
  if (t.zoneLigne || t.ratioLigne) {
    let t = enLigneAvant(n);
    return ennemisVivants(e, r).filter((e) => enLigneAvant(e) === t);
  }
  let i = [n];
  if (t.rebond) {
    let a = ennemisVivants(e, r).sort((e, t) => e.position - t.position);
    let o = a.findIndex((e) => e.ref === n.ref);
    for (let e = 1; e <= t.rebond.sauts; e++) {
      let t = a[o + e];
      if (t) {
        i.push(t);
      }
    }
  }
  return i;
}
export function etatCombatInitial() {
  return {
    effets: [],
    maxRollCharges: 0,
    bouclier: 0,
    paBonusNextTurn: 0,
    cooldowns: {},
    bonusOffensifProchain: 0,
  };
}
export const logDegats = (e, t, n, element, i = ``) => {
  let portion = `${n} dégâts`;
  e.log(`${t}${portion}${i}`, {
    element,
    portion,
  });
};
const BONUS_RAGE = 0.05;
export function gagnerRage(e, t) {
  let n = e.rage ?? 0;
  e.rage = Math.min(3, n + 1);
  if (e.rage > n) {
    t.log(`🐺 ${e.nom} entre en Rage (×${e.rage}).`);
  }
}
const CRIT_PAR_AGILITE = 0.001;
export function chanceCritique(e) {
  return Math.min(1, 0.05 + e.agilite * CRIT_PAR_AGILITE + (e.crit ?? 0) / 100);
}
export function poserBombe(e, t) {
  if (e.estLance || (e.bombes ?? 0) >= 5) {
    return false;
  }
  return (
    (e.bombes = (e.bombes ?? 0) + 1),
    t?.log(`💣 Une bombe colle à ${e.nom} (${e.bombes}/5).`),
    true
  );
}
export function poserTelefrag(e, t, ctx, r) {
  if (!(e.estLance || (e.telefrags ?? 0) >= 4)) {
    e.telefrags = (e.telefrags ?? 0) + 1;
    ctx.log(`⏳ Téléfrag sur ${e.nom} (${e.telefrags}/4).`);
    if (r && sommeEffets(e, `aiguille`) > 0) {
      lancerAttaque(
        r,
        SORTS.aiguille,
        e,
        {
          useMax: false,
          mult: 1,
          ctx,
        },
        `Écho d'Aiguille`,
      );
    }
  }
}
export function ouvrirPortail(e, t) {
  if (!((e.portails ?? 0) >= 4)) {
    e.portails = (e.portails ?? 0) + 1;
    t.log(`🌀 ${e.nom} ouvre un portail (${e.portails}/4).`);
  }
}
export function bonusPortails(e, t) {
  if (e.portails) {
    return 1 + 0.02 * e.portails;
  }
  return (
    1 +
    0.01 *
      Math.max(
        0,
        ...t
          .filter(
            (t) =>
              t.camp === e.camp &&
              t.ref !== e.ref &&
              t.pvActuels > 0 &&
              (t.portails ?? 0) > 0 &&
              enLigneAvant(t) === enLigneAvant(e),
          )
          .map((e) => e.portails ?? 0),
      )
  );
}
export function bonusConjuration(e, t, n) {
  if (!t.conjuration) {
    return 1;
  }
  let r = trouverParRef(n, t.conjuration.lanceurRef);
  let i = !!r && r.pvActuels > 0 && r.camp === e.camp && enLigneAvant(r) === enLigneAvant(e);
  if (e.ref === t.conjuration.lanceurRef || i) {
    return 1 + t.conjuration.pct;
  }
  return 1;
}
export function bonusDegatsCritiques(e) {
  return 0.25 + e.agilite * CRIT_PAR_AGILITE;
}
export function resistanceTotale(e, t) {
  return (e.resistances[t] ?? 0) + sommeEffets(e, `resAll`);
}
function resistanceEffective(e, t, n, r) {
  if (n.ignoreResistances) {
    return 0;
  }
  let i = Math.min(1, (n.perceResistances ?? 0) + (r?.perceResistances ?? 0));
  return resistanceTotale(e, t) * (1 - i);
}
function elementsTries(e, t, n) {
  let r = statsEffectives(e);
  return elementsUtilisables(e)
    .map((i) => [i, multiplicateurStat(statElement(r, i)) * (1 - resistanceEffective(t, i, n, e))])
    .sort((e, t) => t[1] - e[1])
    .map(([e]) => e);
}
export function choisirElement(e, t, n) {
  if (n?.element) {
    return n.element;
  }
  let r = elementsTries(e, t, {
    baseMin: n?.baseMin ?? 0,
    baseMax: n?.baseMax ?? 0,
    ignoreResistances: n?.ignoreResistances,
    perceResistances: n?.perceResistances,
  });
  if (n?.elementPire) {
    return r[r.length - 1];
  }
  return r[0];
}
export function calculerDegats(e, t, n, r) {
  return calculerDegatsDetail(e, t, n, r);
}
export function calculerDegatsDetail(e, t, n, r) {
  let { ctx } = r;
  let a = statsEffectives(e);
  if (!t.sansEsquiveNiCrit && ctx.rng() < chanceEsquive(n)) {
    return {
      dmg: 0,
      esquive: true,
      crit: false,
      element: meilleurElement(e),
    };
  }
  let o = r.useMax ? t.baseMax : tirageEntier(t.baseMin, t.baseMax, ctx.rng);
  let s = elementsTries(e, n, t);
  // un sort peut imposer son élément (sorts élémentaires de l'Huppermage)
  let element = t.element ?? (t.elementPire ? s[s.length - 1] : s[0]);
  o *= multiplicateurStat(statElement(a, element));
  let crit = false;
  if (!t.sansEsquiveNiCrit && ctx.rng() < chanceCritique(a)) {
    o *= 1 + bonusDegatsCritiques(a);
    o *= 1 + sommeEffets(n, `degatsCritSubis`);
    crit = true;
  }
  o *= 1 + sommeEffets(e, `degatsInfliges`);
  if (e.rage) {
    o *= 1 + BONUS_RAGE * Math.min(e.rage, 3);
  }
  if (t.bonusParPADispo && r.paAvant !== undefined) {
    o *= 1 + t.bonusParPADispo * r.paAvant;
  }
  if (t.bonusParTelefrag) {
    o *= 1 + t.bonusParTelefrag * (n.telefrags ?? 0);
  }
  o *= r.mult;
  o *= multiplicateurClasse(e, t, n, ctx);
  o *= multiplicateurDofusDegats(e, n, reliquesActivesDe(e, ctx));
  if (!t.ignoreResistances) {
    o *= 1 - resistanceEffective(n, element, t, e);
  }
  o *= 1 - Math.min(0.8, sommeEffets(n, `reductionDegats`));
  o *= e.camp === `joueur` ? ctx.playerDamageBonus : (ctx.enemyDamageBonus ?? 1);
  if (e.degatsPctDofus) {
    o *= 1 + e.degatsPctDofus;
  }
  if (e.degatsPctPermanent) {
    o *= 1 + e.degatsPctPermanent;
  }
  o *= bonusDegatsIntelligence(a);
  o -= sommeEffets(n, `armure`) + (n.armure ?? 0);
  return {
    dmg: Math.max(0, Math.round(o)),
    esquive: false,
    crit,
    element,
  };
}
export function recalculerPvMax(e) {
  let t = sommeEffets(e, `vitalite`);
  let n = Math.round(e.pvBase * (1 + t));
  let r = n - e.pvMax;
  e.pvMax = n;
  if (r > 0) {
    e.pvActuels += r;
  } else {
    e.pvActuels = Math.min(e.pvActuels, n);
  }
}
export function appliquerEffet(e, t) {
  if (t.stat === `maxRoll`) {
    e.maxRollCharges += t.valeur;
    return;
  }
  e.effets.push({
    stat: t.stat,
    valeur: t.valeur,
    toursRestants: t.duree,
    transmet: t.transmet,
  });
  if (t.stat === `vitalite`) {
    recalculerPvMax(e);
  }
}
export const aFriction = (e) => sommeEffets(e, `friction`) > 0;
export function appliquerPoison(e, t) {
  appliquerEffet(e, {
    stat: `poison`,
    valeur: t.degats,
    duree: t.duree,
    transmet: t.transmet,
  });
}
export function desenvouter(e, t) {
  e.bouclier = 0;
  e.boucliersTemporaires = [];
  let n = [
    `hot`,
    `esquive`,
    `reductionDegats`,
    `armure`,
    `resAll`,
    `vitalite`,
    `force`,
    `intelligence`,
    `agilite`,
    `chance`,
  ];
  let length = e.effets.length;
  // les effets d'un état de classe (Pandawa, Zobal…) restent : ils durent tant que l'état dure
  e.effets = e.effets.filter(
    (e) =>
      e.source === `etat` || !(n.includes(e.stat) || (e.stat === `degatsInfliges` && e.valeur > 0)),
  );
  e.bonusOffensifProchain = 0;
  if (e.effets.length < length) {
    t.log(`${e.nom} est désenvoûté.`);
  }
}
