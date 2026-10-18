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
import { effetRun, sortAmeliore } from "./ameliorations.js";
export const tirageEntier = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));
export const vivants = (combattants) =>
  combattants.filter((combattant) => combattant.pvActuels > 0);
export const trouverParRef = (combattants, ref) =>
  combattants.find((combattant) => combattant.ref === ref);
export const reliquesActivesDe = (combattant, contexte) => {
  if (combattant.camp === `joueur`) {
    return contexte.reliquesActives ?? new Set();
  }
  return new Set();
};
export const ennemisVivants = (combattant, combattants) =>
  vivants(combattants).filter((autre) => autre.camp !== combattant.camp);
export const alliesVivants = (combattant, combattants) =>
  vivants(combattants).filter(
    (autre) => autre.camp === combattant.camp && !autre.estLance && !autre.estInvocation,
  );
export const ELEMENTS = [`terre`, `feu`, `eau`, `air`];
export const sommeEffets = (combattant, stat) =>
  combattant.effets
    .filter((effet) => effet.stat === stat)
    .reduce((acc, item) => acc + item.valeur, 0);
const STATS_ELEMENTAIRES = [`force`, `intelligence`, `agilite`, `chance`];
export function statsEffectives(combattant) {
  let stats = {
    ...combattant.stats,
  };
  for (let stat of STATS_ELEMENTAIRES) {
    let somme = sommeEffets(combattant, stat);
    if (somme) {
      stats[stat] = (stats[stat] ?? 0) + somme;
    }
  }
  let bonusCrit = sommeEffets(combattant, `crit`);
  if (bonusCrit) {
    stats.crit = (stats.crit ?? 0) + bonusCrit;
  }
  return stats;
}
function elementsDominants(combattant) {
  if (combattant.elements) {
    return combattant.elements;
  }
  let stats = statsEffectives(combattant);
  let paires = ELEMENTS.map((element) => [element, statElement(stats, element)]).sort(
    (premier, second) => second[1] - premier[1],
  );
  return [paires[0][0], paires[1][0]];
}
export function elementsUtilisables(combattant) {
  if (combattant.elementLibre) {
    return ELEMENTS;
  }
  return elementsDominants(combattant);
}
export function meilleurElement(combattant) {
  let stats = statsEffectives(combattant);
  return elementsUtilisables(combattant).reduce((acc, item) => {
    if (statElement(stats, item) > statElement(stats, acc)) {
      return item;
    }
    return acc;
  });
}
export const multiplicateurSoinDe = (combattant) =>
  multiplicateurSoin(
    combattant.stats,
    statElement(statsEffectives(combattant), meilleurElement(combattant)),
  );
export const enLigneAvant = (combattant) => combattant.position < 4;
export function chanceEsquive(combattant, options) {
  let stats = statsEffectives(combattant);
  let bonusPosition = options?.sansBonusPosition
    ? 0
    : (combattant.esquiveBonus ?? 0) +
      (enLigneAvant(combattant) ? 0 : (combattant.esquiveArriere ?? 0));
  let bonusEffets = combattant.effets
    .filter((effet) => effet.stat === `esquive` && !(options?.sansViaBrume && effet.viaBrume))
    .reduce((acc, item) => acc + item.valeur, 0);
  // rendement décroissant : l'Agilité seule plafonne à 35 % (les bonus d'effets s'ajoutent avant)
  let ag = Math.max(0, stats.agilite ?? 0);
  let total = ag / (ag + 400) + bonusEffets + bonusPosition;
  if (options?.sansPlafond) {
    return total;
  }
  return Math.min(0.35, total);
}
export function coutPA(sort, combattant) {
  sort = sortAmeliore(combattant, sort);
  // relique de run : le premier sort du combat coûte moins (drapeau retiré au premier lancer)
  let remise = (combattant.remisesCout?.[sort.id] ?? 0) + (combattant.remisePremierSort ?? 0);
  if (remise > 0) {
    // jamais plus cher qu'avant (un sort à 0 PA reste à 0)
    return Math.min(sort.coutPA, Math.max(1, sort.coutPA - remise));
  }
  return sort.coutPA;
}
function filtrerLigneAvant(combattants) {
  let avant = combattants.filter(enLigneAvant);
  if (avant.length) {
    return avant;
  }
  return combattants;
}
const enCooldownSurCible = (combattant, sort, ref) =>
  (combattant.cooldowns[`${sort.id}:${ref}`] ?? 0) > 0;
const enCooldown = (combattant, sort) =>
  !!sort.cooldownTours && (combattant.cooldowns[sort.id] ?? 0) > 0;
export function ciblesValides(lanceur, sort, combattants) {
  sort = sortAmeliore(lanceur, sort);
  let visibles = combattants.filter((combattant) => !combattant.estEgide);
  let cibles;
  switch (sort.cible) {
    case `soi`:
      cibles = [lanceur];
      break;
    case `allie`:
    case `allie_tous`:
      cibles = alliesVivants(lanceur, visibles);
      break;
    case `ennemi_tous`:
      cibles = ennemisVivants(lanceur, visibles).filter((ennemi) => !ennemi.estLance);
      break;
    case `ennemi_ligne`: {
      // la Lance du Forgelance n'est pas une cible (et ne masque pas la ligne arrière)
      let ennemis = ennemisVivants(lanceur, visibles).filter((ennemi) => !ennemi.estLance);
      cibles = sommeEffets(lanceur, `ignoreLigne`) > 0 ? ennemis : filtrerLigneAvant(ennemis);
      break;
    }
    case `mixte`:
      cibles = vivants(visibles);
      break;
  }
  if (lanceur.camp === `ennemi`) {
    let provocateurs = cibles.filter(
      (combattant) =>
        combattant.camp === `joueur` && combattant.provoque && combattant.pvActuels > 0,
    );
    if (provocateurs.length) {
      cibles = provocateurs;
    }
  }
  if (sort.zoneLance) {
    let lance = vivants(combattants).find(
      (candidat) => candidat.estLance && candidat.lanceurRef === lanceur.ref,
    );
    if (lance && !cibles.some((cible) => cible.ref === lance.ref)) {
      cibles = [...cibles, lance];
    }
  }
  if (
    (sort.cible === `ennemi_tous` || sort.cible === `ennemi_ligne` || sort.cible === `mixte`) &&
    sommeEffets(lanceur, `tetanise`) > 0 &&
    sommeEffets(lanceur, `ignoreLigne`) <= 0
  ) {
    cibles = cibles.filter((cible) => cible.camp === lanceur.camp || enLigneAvant(cible));
  }
  if (
    (sort.type === `buff` &&
      sort.effetRangeeAlliee &&
      !membresRangee(lanceur, sort.effetRangeeAlliee, combattants).length) ||
    (sort.consommeRage && !(lanceur.rage ?? 0)) ||
    (sort.pasPremierTour && (lanceur.toursJoues ?? 0) <= 1) ||
    (sort.posePortail && (lanceur.portails ?? 0) >= 4) ||
    (sort.kaboom &&
      !ennemisVivants(lanceur, combattants).some((ennemi) => (ennemi.bombes ?? 0) > 0)) ||
    (sort.invoqueLance &&
      vivants(combattants).some((combattant) => combattant.ref === `lance_${lanceur.ref}`)) ||
    (sort.rappelleLance &&
      !vivants(combattants).some((combattant) => combattant.ref === `lance_${lanceur.ref}`)) ||
    (sort.invoqueEgide &&
      vivants(combattants).some((combattant) => combattant.ref === `egide_${lanceur.ref}`)) ||
    (sort.invoqueEgide &&
      (cibles = cibles.filter(
        (cible) => caseLibreSurLigne(lanceur.camp, enLigneAvant(cible), combattants) !== null,
      )),
    sort.changeLigne && caseOpposeeLibre(lanceur, combattants) === null) ||
    enCooldown(lanceur, sort) ||
    sortIndisponible(lanceur, sort, combattants) ||
    (sort.cooldown &&
      (cibles = cibles.filter((cible) => !enCooldownSurCible(lanceur, sort, cible.ref))),
    sort.maxParTour && (lanceur.lancersCeTour?.[sort.id] ?? 0) >= sort.maxParTour)
  ) {
    return [];
  }
  if (sort.maxParCibleParTour) {
    cibles = cibles.filter(
      (cible) =>
        (lanceur.lancersCeTour?.[`${sort.id}:${cible.ref}`] ?? 0) < sort.maxParCibleParTour,
    );
  }
  return filtrerCiblesClasse(lanceur, sort, cibles);
}
// Pourquoi un sort ne peut pas être lancé maintenant : libellé court pour l'interface, ou null.
// Reprend dans l'ordre le coût en PA, la recharge, puis les conditions de ciblesValides.
export function raisonIndisponible(lanceur, sort, combattants) {
  sort = sortAmeliore(lanceur, sort);
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
  const lanceVivante = (ref) => vivants(combattants).some((combattant) => combattant.ref === ref);
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
  if (
    sort.kaboom &&
    !ennemisVivants(lanceur, combattants).some((ennemi) => (ennemi.bombes ?? 0) > 0)
  ) {
    return `Aucune bombe posée`;
  }
  if (sort.invoqueCreature && sortIndisponible(lanceur, sort, combattants)) {
    const deja = vivants(combattants).some(
      (combattant) => combattant.ref === `crea_${sort.invoqueCreature}_${lanceur.ref}`,
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
export function reinitialiserTour(combattant) {
  combattant.lancersCeTour = {};
  combattant.remisesCout = {};
  combattant.veilleursRecuCeTour = false;
}
export function multiplicateurRelance(sort, lanceur) {
  if (lanceur) {
    return (
      (sort.bonusParRelanceCeTour
        ? 1 + sort.bonusParRelanceCeTour * Math.max(0, lanceur.lancersCeTour?.[sort.id] ?? 0)
        : 1) *
      (sort.bonusParLancerCombat
        ? 1 +
          Math.min(
            sort.plafondBonusLancerCombat ?? Infinity,
            sort.bonusParLancerCombat * Math.max(0, lanceur.lancersCombat?.[sort.id] ?? 0),
          )
        : 1)
    );
  }
  return 1;
}
export function ciblesTouchees(lanceur, sort, cible, combattants) {
  if (sort.zoneLance) {
    if (sort.tousSiLanceArriere && cible.estLance && !enLigneAvant(cible)) {
      return ennemisVivants(lanceur, combattants);
    }
    let devant = enLigneAvant(cible);
    return ennemisVivants(lanceur, combattants).filter(
      (combattant) => enLigneAvant(combattant) === devant,
    );
  }
  if (sort.zoneLigne || sort.ratioLigne) {
    let devant = enLigneAvant(cible);
    return ennemisVivants(lanceur, combattants).filter(
      (combattant) => enLigneAvant(combattant) === devant,
    );
  }
  let touchees = [cible];
  if (sort.rebond) {
    let ennemis = ennemisVivants(lanceur, combattants).sort(
      (premier, second) => premier.position - second.position,
    );
    let indice = ennemis.findIndex((combattant) => combattant.ref === cible.ref);
    for (let saut = 1; saut <= sort.rebond.sauts; saut++) {
      let suivant = ennemis[indice + saut];
      if (suivant) {
        touchees.push(suivant);
      }
    }
  }
  return touchees;
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
export const logDegats = (contexte, prefixe, montant, element, suffixe = ``) => {
  let portion = `${montant} dégâts`;
  contexte.log(`${prefixe}${portion}${suffixe}`, {
    element,
    portion,
  });
};
const BONUS_RAGE = 0.05;
export function gagnerRage(combattant, contexte) {
  let avant = combattant.rage ?? 0;
  combattant.rage = Math.min(3, avant + 1);
  if (combattant.rage > avant) {
    contexte.log(`🐺 ${combattant.nom} entre en Rage (×${combattant.rage}).`);
  }
}
const CRIT_PAR_AGILITE = 0.001;
export function chanceCritique(stats) {
  return Math.min(1, 0.05 + stats.agilite * CRIT_PAR_AGILITE + (stats.crit ?? 0) / 100);
}
export function poserBombe(combattant, contexte) {
  if (combattant.estLance || (combattant.bombes ?? 0) >= 5) {
    return false;
  }
  return (
    (combattant.bombes = (combattant.bombes ?? 0) + 1),
    contexte?.log(`💣 Une bombe colle à ${combattant.nom} (${combattant.bombes}/5).`),
    true
  );
}
export function poserTelefrag(combattant, sort, ctx, lanceur) {
  if (!(combattant.estLance || (combattant.telefrags ?? 0) >= 4)) {
    combattant.telefrags = (combattant.telefrags ?? 0) + 1;
    ctx.log(`⏳ Téléfrag sur ${combattant.nom} (${combattant.telefrags}/4).`);
    if (lanceur && sommeEffets(combattant, `aiguille`) > 0) {
      lancerAttaque(
        lanceur,
        SORTS.aiguille,
        combattant,
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
export function ouvrirPortail(combattant, contexte) {
  if (!((combattant.portails ?? 0) >= 4)) {
    combattant.portails = (combattant.portails ?? 0) + 1;
    contexte.log(`🌀 ${combattant.nom} ouvre un portail (${combattant.portails}/4).`);
  }
}
export function bonusPortails(combattant, combattants) {
  if (combattant.portails) {
    return 1 + 0.02 * combattant.portails;
  }
  return (
    1 +
    0.01 *
      Math.max(
        0,
        ...combattants
          .filter(
            (autre) =>
              autre.camp === combattant.camp &&
              autre.ref !== combattant.ref &&
              autre.pvActuels > 0 &&
              (autre.portails ?? 0) > 0 &&
              enLigneAvant(autre) === enLigneAvant(combattant),
          )
          .map((autre) => autre.portails ?? 0),
      )
  );
}
export function bonusConjuration(combattant, sort, combattants) {
  if (!sort.conjuration) {
    return 1;
  }
  let lanceur = trouverParRef(combattants, sort.conjuration.lanceurRef);
  let protege =
    !!lanceur &&
    lanceur.pvActuels > 0 &&
    lanceur.camp === combattant.camp &&
    enLigneAvant(lanceur) === enLigneAvant(combattant);
  if (combattant.ref === sort.conjuration.lanceurRef || protege) {
    return 1 + sort.conjuration.pct;
  }
  return 1;
}
export function bonusDegatsCritiques(stats) {
  return 0.25 + stats.agilite * CRIT_PAR_AGILITE;
}
export function resistanceTotale(combattant, element) {
  return (combattant.resistances[element] ?? 0) + sommeEffets(combattant, `resAll`);
}
function resistanceEffective(cible, element, sort, lanceur) {
  if (sort.ignoreResistances) {
    return 0;
  }
  let perce = Math.min(1, (sort.perceResistances ?? 0) + (lanceur?.perceResistances ?? 0));
  return resistanceTotale(cible, element) * (1 - perce);
}
function elementsTries(lanceur, cible, sort) {
  let stats = statsEffectives(lanceur);
  return elementsUtilisables(lanceur)
    .map((element) => [
      element,
      multiplicateurStat(statElement(stats, element)) *
        (1 - resistanceEffective(cible, element, sort, lanceur)),
    ])
    .sort((premier, second) => second[1] - premier[1])
    .map(([element]) => element);
}
export function choisirElement(lanceur, cible, sort) {
  if (sort?.element) {
    return sort.element;
  }
  let tries = elementsTries(lanceur, cible, {
    baseMin: sort?.baseMin ?? 0,
    baseMax: sort?.baseMax ?? 0,
    ignoreResistances: sort?.ignoreResistances,
    perceResistances: sort?.perceResistances,
  });
  if (sort?.elementPire) {
    return tries[tries.length - 1];
  }
  return tries[0];
}
export function calculerDegats(lanceur, sort, cible, options) {
  return calculerDegatsDetail(lanceur, sort, cible, options);
}
export function calculerDegatsDetail(lanceur, sort, cible, options) {
  // sort amélioré du héros (sans effet sur une copie déjà améliorée) : aperçus compris
  sort = sortAmeliore(lanceur, sort);
  let { ctx } = options;
  let stats = statsEffectives(lanceur);
  if (!sort.sansEsquiveNiCrit && ctx.rng() < chanceEsquive(cible)) {
    return {
      dmg: 0,
      esquive: true,
      crit: false,
      element: meilleurElement(lanceur),
    };
  }
  let degats = options.useMax ? sort.baseMax : tirageEntier(sort.baseMin, sort.baseMax, ctx.rng);
  let tries = elementsTries(lanceur, cible, sort);
  // un sort peut imposer son élément (sorts élémentaires de l'Huppermage)
  let element = sort.element ?? (sort.elementPire ? tries[tries.length - 1] : tries[0]);
  degats *= multiplicateurStat(statElement(stats, element));
  let crit = false;
  if (!sort.sansEsquiveNiCrit && ctx.rng() < chanceCritique(stats) + (sort.critBonusSort ?? 0)) {
    degats *= 1 + bonusDegatsCritiques(stats);
    degats *= 1 + sommeEffets(cible, `degatsCritSubis`);
    crit = true;
  }
  degats *= 1 + sommeEffets(lanceur, `degatsInfliges`);
  if (lanceur.rage) {
    degats *= 1 + BONUS_RAGE * Math.min(lanceur.rage, 3);
  }
  if (sort.bonusParPADispo && options.paAvant !== undefined) {
    degats *= 1 + sort.bonusParPADispo * options.paAvant;
  }
  if (sort.bonusParTelefrag) {
    degats *= 1 + sort.bonusParTelefrag * (cible.telefrags ?? 0);
  }
  degats *= options.mult;
  degats *= multiplicateurClasse(lanceur, sort, cible, ctx);
  degats *= multiplicateurDofusDegats(lanceur, cible, reliquesActivesDe(lanceur, ctx));
  if (!sort.ignoreResistances) {
    degats *= 1 - resistanceEffective(cible, element, sort, lanceur);
  }
  degats *= 1 - Math.min(0.8, sommeEffets(cible, `reductionDegats`));
  degats *= lanceur.camp === `joueur` ? ctx.playerDamageBonus : (ctx.enemyDamageBonus ?? 1);
  if (lanceur.degatsPctDofus) {
    degats *= 1 + lanceur.degatsPctDofus;
  }
  if (lanceur.degatsPctPermanent) {
    degats *= 1 + lanceur.degatsPctPermanent;
  }
  if (lanceur.effetsRun) {
    degats *= multiplicateurReliquesRun(lanceur, cible, ctx);
  }
  degats *= bonusDegatsIntelligence(stats);
  degats -= sommeEffets(cible, `armure`) + (cible.armure ?? 0);
  return {
    dmg: Math.max(0, Math.round(degats)),
    esquive: false,
    crit,
    element,
  };
}
// Reliques de run offensives d'un héros : ligne arrière, achèvement, premier tour, dernier debout.
export function multiplicateurReliquesRun(lanceur, cible, ctx) {
  let mult = 1;
  if (cible.camp !== lanceur.camp) {
    if (!enLigneAvant(cible)) {
      mult *= 1 + effetRun(lanceur, `degatsLigneArriere`);
    }
    if (cible.pvActuels <= cible.pvMax * 0.3) {
      mult *= 1 + effetRun(lanceur, `degatsAchevement`);
    }
  }
  if (lanceur.toursJoues === 1) {
    mult *= 1 + effetRun(lanceur, `degatsPremierTour`);
  }
  const dernier = effetRun(lanceur, `degatsDernierDebout`);
  if (
    dernier &&
    ctx?.combatants &&
    alliesVivants(lanceur, ctx.combatants).filter((allie) => !allie.creature).length === 1
  ) {
    mult *= 1 + dernier;
  }
  return mult;
}
export function recalculerPvMax(combattant) {
  let bonus = sommeEffets(combattant, `vitalite`);
  let pvMax = Math.round(combattant.pvBase * (1 + bonus));
  let ecart = pvMax - combattant.pvMax;
  combattant.pvMax = pvMax;
  if (ecart > 0) {
    combattant.pvActuels += ecart;
  } else {
    combattant.pvActuels = Math.min(combattant.pvActuels, pvMax);
  }
}
export function appliquerEffet(combattant, effet) {
  if (effet.stat === `maxRoll`) {
    combattant.maxRollCharges += effet.valeur;
    return;
  }
  combattant.effets.push({
    stat: effet.stat,
    valeur: effet.valeur,
    toursRestants: effet.duree,
    transmet: effet.transmet,
  });
  if (effet.stat === `vitalite`) {
    recalculerPvMax(combattant);
  }
}
export const aFriction = (combattant) => sommeEffets(combattant, `friction`) > 0;
export function appliquerPoison(cible, poison) {
  appliquerEffet(cible, {
    stat: `poison`,
    valeur: poison.degats,
    duree: poison.duree,
    transmet: poison.transmet,
  });
}
export function desenvouter(combattant, contexte) {
  combattant.bouclier = 0;
  combattant.boucliersTemporaires = [];
  let stats = [
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
  let nbAvant = combattant.effets.length;
  // les effets d'un état de classe (Pandawa, Zobal…) restent : ils durent tant que l'état dure
  combattant.effets = combattant.effets.filter(
    (effet) =>
      effet.source === `etat` ||
      !(stats.includes(effet.stat) || (effet.stat === `degatsInfliges` && effet.valeur > 0)),
  );
  combattant.bonusOffensifProchain = 0;
  if (combattant.effets.length < nbAvant) {
    contexte.log(`${combattant.nom} est désenvoûté.`);
  }
}
