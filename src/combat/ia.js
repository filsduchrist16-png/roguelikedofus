import { SORTS } from "../data/index.js";
import {
  alliesVivants,
  calculerDegatsDetail,
  ciblesTouchees,
  ciblesValides,
  coutPA,
  ennemisVivants,
  multiplicateurSoinDe,
  sommeEffets,
} from "./stats.js";
import { peutInvoquer } from "./effets.js";

// IA des monstres (et des créatures invoquées par les héros). Elle ne triche pas : elle ne voit que
// ce que le joueur voit (PV, boucliers, effets posés) et estime ses dégâts sans tirage au sort.
// Chaque action possible reçoit une note, en pourcentage de vie « utile » retiré ou rendu :
// - achever une cible vaut cher, surtout un soigneur ou un héros fragile ;
// - les dégâts au-delà des PV de la cible ne comptent pas (pas de gros sort gâché sur 5 PV) ;
// - une cible déjà condamnée par son poison ne vaut presque plus rien ;
// - un sort qui protège ou renforce le lanceur vaut plus quand l'effet n'est pas déjà actif ;
// - la note ajoute ce que les PA restants permettront encore de faire ensuite.

// Dégâts moyens d'un sort sur une cible, sans esquive ni coup critique (calcul pur).
export function estimerDegats(lanceur, sort, cible, contexte) {
  if (!sort.baseMax) {
    return 0;
  }
  // tirages dans l'ordre du calcul : esquive (ratée), jet (médian), critique (raté)
  let tirages = sort.sansEsquiveNiCrit ? [0.5] : [0.99, 0.5, 0.99];
  let indice = 0;
  let ctx = {
    rng: () => tirages[Math.min(indice++, tirages.length - 1)],
    playerDamageBonus: contexte?.playerDamageBonus ?? 1,
    enemyDamageBonus: contexte?.enemyDamageBonus ?? 1,
    reliquesActives: contexte?.reliquesActives,
  };
  return calculerDegatsDetail(lanceur, sort, cible, { mult: 1, ctx }).dmg;
}

// PV à retirer pour faire tomber un combattant (bouclier compris).
export const pvEffectifs = (combattant) =>
  Math.max(0, combattant.pvActuels) + Math.max(0, combattant.bouclier ?? 0);

// Le poison posé suffira à le tuer au début de son prochain tour.
export const estCondamne = (combattant) =>
  sommeEffets(combattant, `poison`) >= combattant.pvActuels && combattant.pvActuels > 0;

const aUnSoin = (combattant) => combattant.sorts?.some((id) => SORTS[id]?.type === `soin`);

// Priorité d'une cible : soigneurs et combattants fragiles (peu de PV max dans leur camp) d'abord.
function prioriteCible(cible, adversaires) {
  let pvMaxCamp = Math.max(1, ...adversaires.map((autre) => autre.pvMax));
  let poids = 1 + 0.15 * (1 - cible.pvMax / pvMaxCamp);
  if (aUnSoin(cible)) {
    poids += 0.3;
  }
  if (estCondamne(cible)) {
    poids *= 0.15;
  }
  return poids;
}

const effetActif = (combattant, stat) => combattant.effets?.some((effet) => effet.stat === stat);

// Valeur d'un sort de dégâts lancé sur `cible` (zone comprise). `morts` : cibles déjà comptées
// comme achevées par une action précédente du même tour (pour la suite du calcul).
function valeurDegats(acteur, sort, cible, combattants, contexte, morts = new Set()) {
  let adversaires = ennemisVivants(acteur, combattants).filter((autre) => !autre.estLance);
  let valeur = 0;
  let acheve = [];
  for (let touche of ciblesTouchees(acteur, sort, cible, combattants)) {
    if (touche.camp === acteur.camp || touche.estLance || touche.pvActuels <= 0) {
      continue;
    }
    if (morts.has(touche.ref)) {
      continue;
    }
    let estime = estimerDegats(acteur, sort, touche, contexte);
    let ratio = sort.ratioLigne && touche.ref !== cible.ref ? sort.ratioLigne : 1;
    estime *= ratio;
    let pv = pvEffectifs(touche);
    let poids = prioriteCible(touche, adversaires);
    // en pourcentage de la vie de la cible : 20 PV sur un héros fragile valent plus que sur un tank
    let enPct = 100 / Math.max(1, touche.pvMax);
    valeur += Math.min(estime, pv) * enPct * poids;
    if (estime >= pv && !estCondamne(touche)) {
      // achever : une menace de moins dès maintenant
      valeur += 60 * poids;
      acheve.push(touche.ref);
    }
    if (sort.poison && !estCondamne(touche) && estime < pv) {
      valeur +=
        0.6 * (sort.poison.degats ?? 0) * Math.min(sort.poison.duree ?? 1, 3) * enPct * poids;
    }
    if (sort.effet && !effetActif(touche, sort.effet.stat) && estime < pv) {
      // affaiblir une cible qui restera debout (et pas déjà affaiblie)
      valeur += 10 * poids;
    }
    if (sort.retraitPA && estime < pv) {
      valeur += 6 * sort.retraitPA * (sort.retraitPAChance ?? 1);
    }
  }
  let blesse = acteur.pvMax > 0 ? 1 - acteur.pvActuels / acteur.pvMax : 0;
  if (sort.effetLanceur && !effetActif(acteur, sort.effetLanceur.stat)) {
    // protection ou renfort : surtout utile quand le lanceur a déjà pris des coups
    valeur += 8 + 30 * blesse;
  }
  if (sort.vampirismeRatio || sort.bouclierRatioDegats) {
    valeur *= 1 + 0.5 * blesse;
  }
  return { valeur, acheve };
}

// Sorts de dégâts lançables maintenant, avec leurs cibles.
function actionsDegats(acteur, combattants, paDispo) {
  let actions = [];
  for (let id of acteur.sorts) {
    let sort = SORTS[id];
    if (!sort || sort.type !== `degats` || paDispo < coutPA(sort, acteur)) {
      continue;
    }
    for (let cible of ciblesValides(acteur, sort, combattants)) {
      if (cible.camp !== acteur.camp) {
        actions.push({ sort, cible });
      }
    }
  }
  return actions;
}

// Meilleure attaque, en tenant compte de ce que les PA restants permettront ensuite.
function meilleureAttaque(acteur, combattants, contexte) {
  let actions = actionsDegats(acteur, combattants, acteur.paActuels);
  let meilleure = null;
  for (let { sort, cible } of actions) {
    let { valeur, acheve } = valeurDegats(acteur, sort, cible, combattants, contexte);
    let reste = acteur.paActuels - coutPA(sort, acteur);
    let suite = 0;
    if (reste > 0) {
      let morts = new Set(acheve);
      for (let suivante of actionsDegats(acteur, combattants, reste)) {
        // un sort à recharge ou limité ne se relance pas dans le même tour
        if (
          suivante.sort.id === sort.id &&
          (sort.cooldownTours || sort.cooldown || sort.maxParTour === 1)
        ) {
          continue;
        }
        if (morts.has(suivante.cible.ref)) {
          continue;
        }
        let note = valeurDegats(
          acteur,
          suivante.sort,
          suivante.cible,
          combattants,
          contexte,
          morts,
        );
        suite = Math.max(suite, note.valeur);
      }
    }
    // à valeur égale, achever tout de suite (le coup suivant peut être esquivé)
    let total = valeur + suite + (acheve.length ? 1 : 0);
    if (!meilleure || total > meilleure.total + 1e-9) {
      meilleure = { sort, cible, total, valeur, acheve };
    }
  }
  return meilleure;
}

function invocationPossible(acteur, combattants) {
  return acteur.sorts
    .map((idSort) => SORTS[idSort])
    .find(
      (sort) =>
        sort?.type === `invocation` &&
        acteur.paActuels >= coutPA(sort, acteur) &&
        ciblesValides(acteur, sort, combattants).length > 0 &&
        peutInvoquer(acteur, sort, combattants),
    );
}

function iaAgressive(acteur, combattants, contexte) {
  let attaque = meilleureAttaque(acteur, combattants, contexte);
  // achever une cible passe avant tout ; sinon on invoque d'abord (comme avant)
  if (!attaque?.acheve.length) {
    let sortInvocation = invocationPossible(acteur, combattants);
    if (sortInvocation) {
      return { sort: sortInvocation, cibleRef: acteur.ref };
    }
  }
  if (attaque) {
    return { sort: attaque.sort, cibleRef: attaque.cible.ref };
  }
  return null;
}

// Soin moyen d'un sort sur un allié.
function estimerSoin(acteur, sort, allie) {
  if (sort.soinComplet) {
    return allie.pvMax - allie.pvActuels;
  }
  return ((sort.baseMin + sort.baseMax) / 2) * multiplicateurSoinDe(acteur);
}

// Valeur d'un soin : PV réellement rendus, comptés double sur un allié en danger ; un allié
// presque plein ne mérite pas un sort (pas de soin gaspillé).
function valeurSoin(acteur, sort, cible, combattants) {
  let soutenus = sort.cible === `allie_tous` ? alliesVivants(acteur, combattants) : [cible];
  let valeur = 0;
  for (let allie of soutenus) {
    let manque = allie.pvMax - allie.pvActuels;
    if (manque <= 0) {
      continue;
    }
    let soin = estimerSoin(acteur, sort, allie);
    let utile = Math.min(soin, manque);
    let part = allie.pvActuels / allie.pvMax;
    if (part > 0.75 && utile < 0.6 * soin) {
      continue;
    }
    let poids = part < 0.35 ? 2 : part < 0.6 ? 1.3 : 0.7;
    if (allie.boss) {
      poids *= 1.4;
    }
    valeur += ((utile * 100) / Math.max(1, allie.pvMax)) * poids;
  }
  return valeur;
}

function iaSoutien(acteur, combattants, contexte) {
  let meilleurSoin = null;
  for (let id of acteur.sorts) {
    let sort = SORTS[id];
    if (!sort || sort.type !== `soin` || acteur.paActuels < coutPA(sort, acteur)) {
      continue;
    }
    for (let cible of ciblesValides(acteur, sort, combattants)) {
      let valeur = valeurSoin(acteur, sort, cible, combattants);
      if (valeur > 0 && (!meilleurSoin || valeur > meilleurSoin.valeur)) {
        meilleurSoin = { sort, cible, valeur };
      }
    }
  }
  if (meilleurSoin) {
    let attaque = meilleureAttaque(acteur, combattants, contexte);
    // achever un héros vaut mieux qu'un petit soin ; un allié en danger passe avant
    if (!attaque || !attaque.acheve.length || meilleurSoin.valeur >= attaque.valeur) {
      return { sort: meilleurSoin.sort, cibleRef: meilleurSoin.cible.ref };
    }
  }
  return iaAgressive(acteur, combattants, contexte);
}

// `contexte` (facultatif) : bonus de dégâts du combat, pour estimer les coups au plus juste.
export const choisirActionIA = (acteur, combattants, contexte) => {
  if (acteur.ia === `soutien`) {
    return iaSoutien(acteur, combattants, contexte);
  }
  return iaAgressive(acteur, combattants, contexte);
};
