// Cases « Camp de repos » et « Coffre » de la carte, et reliques de run vendues ou offertes hors
// des combats (colporteur, autel de sang, taverne). Logique pure : le hasard est injecté, les écrans
// sont dans src/deroule/noeud.js et src/deroule/rencontres.js.
import { RELIQUES_RUN } from "../data/index.js";
import { CONFIG_CARTE, ECONOMIE } from "./config.js";
import { pvMaxPerso, soignerEquipe } from "./run.js";
import {
  poidsRaretes,
  reliquesRunDe,
  tirerAmeliorationSort,
  tirerReliqueRun,
} from "./recompensesRun.js";

const CROCHETEURS = new Set([`sram`, `roublard`, `ecaflip`]);
function tirerPoids(poids, rng) {
  const entrees = Object.entries(poids).filter(([, valeur]) => valeur > 0);
  const total = entrees.reduce((somme, [, valeur]) => somme + valeur, 0);
  let tirage = rng() * total;
  for (const [cle, valeur] of entrees) {
    tirage -= valeur;
    if (tirage < 0) {
      return cle;
    }
  }
  return entrees[0]?.[0] ?? `commun`;
}
const totalPv = (run) =>
  run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);

// ---------- Camp de repos ----------
/**
 * Choix du camp : se reposer (30 % des PV max) ou améliorer gratuitement un sort parmi trois
 * (héros et sorts différents). `progression` (0 → 1 sur les zones du monde) relève la rareté.
 */
export function optionsCamp(run, rng, progression = 0) {
  const poids = poidsRaretes(false, progression);
  const exclus = new Set();
  const ameliorations = [];
  for (let essai = 0; essai < 3; essai++) {
    const choix = tirerAmeliorationSort(run, rng, tirerPoids(poids, rng), exclus);
    if (!choix) {
      break;
    }
    exclus.add(`sort:${choix.heros}:${choix.sort}`);
    ameliorations.push(choix);
  }
  return { soinPct: CONFIG_CARTE.campSoin, ameliorations };
}
/** Repos au camp : renvoie les PV rendus à l'équipe. */
export function reposCamp(run, pct = CONFIG_CARTE.campSoin) {
  const avant = totalPv(run);
  soignerEquipe(run, pct);
  return totalPv(run) - avant;
}

// ---------- Coffre ----------
export const peutCrocheterCoffre = (run) =>
  run.persos.some((perso) => perso.pvActuels > 0 && CROCHETEURS.has(perso.classeId));
/**
 * Contenu d'un coffre : celui tiré avec la carte, sinon (ancienne carte, zaap) tiré maintenant.
 * Un crocheteur (Sram, Roublard, Ecaflip) debout désamorce le piège. Renvoie { tresor, piege }.
 */
export function contenuCoffre(noeud, rng, { crocheteur = false } = {}) {
  const { piege, relique } = CONFIG_CARTE.coffre;
  let contenu = noeud && (noeud.tresor === `relique` || noeud.tresor === `objet`) ? noeud : null;
  if (!contenu) {
    const tresor = rng() < relique ? `relique` : `objet`;
    contenu = { tresor, piege: rng() < piege ? (rng() < 0.5 ? `combat` : `pv`) : undefined };
  }
  return {
    tresor: contenu.tresor,
    piege: crocheteur
      ? null
      : contenu.piege === `combat` || contenu.piege === `pv`
        ? contenu.piege
        : null,
  };
}
/** Piège à aiguilles : chaque héros debout perd une part de ses PV max (sans tomber). */
export function piegePv(run, part = CONFIG_CARTE.coffre.pertePv) {
  let perte = 0;
  for (const perso of run.persos) {
    if (perso.pvActuels > 0) {
      const avant = perso.pvActuels;
      perso.pvActuels = Math.max(1, Math.round(perso.pvActuels - pvMaxPerso(perso) * part));
      perte += avant - perso.pvActuels;
    }
  }
  return perte;
}
/** Relique d'un coffre : rareté d'élite (le coffre récompense le détour), null si tout est pris. */
export function reliqueDeCoffre(run, rng, progression = 0) {
  return tirerReliqueRun(run, rng, tirerPoids(poidsRaretes(true, progression), rng));
}

// ---------- Reliques à vendre ou à gagner hors combat ----------
// Prix d'une relique selon sa rareté, en multiples du gain d'un combat dur de la zone.
export const PRIX_RELIQUE = { commun: 2, rare: 3.2, epique: 5 };
// Le tavernier prend sa marge.
export const MARGE_TAVERNE = 1.25;
const gainElite = (toile) =>
  Math.round(ECONOMIE.gain.combat_dur * (1 + ECONOMIE.gainParToile * (toile - 1)));
/** Prix d'une relique de run dans la zone de numéro `toile`. */
export function prixReliqueRun(id, toile = 1, marge = 1) {
  const rarete = RELIQUES_RUN[id]?.rarete ?? `commun`;
  return Math.round(gainElite(toile) * (PRIX_RELIQUE[rarete] ?? PRIX_RELIQUE.commun) * marge);
}
/** Jusqu'à `nombre` reliques différentes que l'équipe n'a pas, de raretés tirées selon `poids`. */
export function reliquesProposees(
  run,
  rng,
  nombre = 3,
  poids = { commun: 50, rare: 38, epique: 12 },
) {
  const exclus = new Set();
  const out = [];
  for (let essai = 0; essai < nombre; essai++) {
    const choix = tirerReliqueRun(run, rng, tirerPoids(poids, rng), exclus);
    if (!choix) {
      break;
    }
    exclus.add(`relique:${choix.id}`);
    out.push(choix.id);
  }
  return out;
}
/** Achète une relique : false si elle est déjà possédée, inconnue ou trop chère. */
export function acheterReliqueRun(run, id, prix) {
  if (!RELIQUES_RUN[id] || reliquesRunDe(run).includes(id) || run.kamas < prix) {
    return false;
  }
  run.kamas -= prix;
  (run.reliquesRun ??= []).push(id);
  return true;
}
// Autel de sang : chaque relique prise coûte 8 % des PV max en combat, jusqu'à la fin de la run.
export const SACRIFICE_AUTEL = 0.08;
export const SACRIFICE_MAX = 0.4;
/** Pacte de l'autel : la relique contre des PV max (cumulés dans `run.sacrificePv`). */
export function pacteAutel(run, id) {
  if (!RELIQUES_RUN[id] || reliquesRunDe(run).includes(id)) {
    return false;
  }
  if ((run.sacrificePv ?? 0) + SACRIFICE_AUTEL > SACRIFICE_MAX + 1e-9) {
    return false;
  }
  run.sacrificePv = Math.round(((run.sacrificePv ?? 0) + SACRIFICE_AUTEL) * 100) / 100;
  (run.reliquesRun ??= []).push(id);
  return true;
}
/** Relique en vente à la taverne (une seule, plus chère qu'ailleurs) ou null. */
export function reliqueTaverne(run, rng, toile = 1) {
  const [id] = reliquesProposees(run, rng, 1);
  return id ? { id, prix: prixReliqueRun(id, toile, MARGE_TAVERNE) } : null;
}
