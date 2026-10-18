// Rencontres du Krosmoz (1.9.0, src/data/rencontres.json) : Otomaï, le Dieu Xélor, un Wabbit, les
// milices de Bonta et Brâkmar, un Dopeul, un marchand d'âmes, le Shushu Rubilax. Chaque choix a une
// ou plusieurs issues tirées au hasard ; une issue peut imposer un combat de la zone avant ses
// effets. Logique pure (hasard injecté) : l'écran et le combat sont dans src/deroule/rencontres.js.
import { BENEDICTIONS, gainBase } from "./rencontres.js";
import { CLASSES, RENCONTRES } from "../data/index.js";
import { XP_PAR_COMBAT, calculerXpCombat } from "./config.js";
import { ajouterKamas } from "./economie.js";
import { effetsDifficulte, gagnerXpPerso, peutGagnerXp, pvMaxPerso, soignerEquipe } from "./run.js";
import {
  appliquerChoix,
  pointsStats,
  sacrificePvRun,
  sortsAApprendre,
  tirerAmeliorationSort,
  tirerReliqueRun,
} from "./recompensesRun.js";

/** Identifiants des rencontres du Krosmoz. */
export const RENCONTRES_LORE = Object.keys(RENCONTRES);
export const estRencontreLore = (id) => !!RENCONTRES[id];

const choisir = (liste, rng) => liste[Math.floor(rng() * liste.length)];
const herosDebout = (run) =>
  effetsDifficulte(run.ascension).mortDefinitive
    ? run.persos.filter((perso) => perso.pvActuels > 0)
    : run.persos;
/** Prix d'un choix en kamas (multiple du gain de base de la zone). */
export const prixChoix = (choix, toile) =>
  choix.prix ? Math.max(1, Math.round(choix.prix * gainBase(toile))) : 0;

/**
 * Prépare une rencontre : le héros visé (Dopeul…) et le texte de chaque choix, prix et raisons de
 * blocage compris. `heros` : un héros tiré au hasard si la rencontre en a besoin.
 */
export function preparerRencontreLore(run, id, { rng, toile = 1 }) {
  const def = RENCONTRES[id];
  const heros = choisir(herosDebout(run).length ? herosDebout(run) : run.persos, rng);
  const nomHeros = CLASSES[heros.classeId]?.nom ?? heros.classeId;
  const remplacer = (texte) =>
    (texte ?? ``)
      .replaceAll(`{heros}`, nomHeros)
      .replaceAll(`{stats}`, `+${pointsStats(heros.progression?.niveau ?? 1)}`);
  const choix = def.choix.map((option) => {
    const prix = prixChoix(option, toile);
    const effets = (option.issues ?? []).map((issue) => issue.effets ?? {});
    let desactive = ``;
    if (prix && run.kamas < prix) {
      desactive = `Pas assez de kamas.`;
    } else if (
      effets.length &&
      effets.every((effet) => effet.xp) &&
      !run.persos.some((perso) => peutGagnerXp(perso, run.trancheId))
    ) {
      desactive = `Tes héros sont au niveau maximal du monde.`;
    } else if (
      effets.some((effet) => effet.sacrificePv) &&
      sacrificePvRun(run) + Math.max(...effets.map((effet) => effet.sacrificePv ?? 0)) > 0.4 + 1e-9
    ) {
      desactive = `Ton pacte de sang est déjà au plus fort (40 %).`;
    }
    return {
      id: option.id,
      libelle: option.libelle,
      detail: remplacer(option.detail),
      ...(prix ? { prix } : {}),
      ...(desactive ? { desactive } : {}),
    };
  });
  // le Dopeul prend le visage du héros visé
  const img = def.img ?? (id === `dopeul` ? CLASSES[heros.classeId]?.img : undefined);
  return {
    id,
    titre: def.titre,
    img,
    texte: remplacer(def.texte).replace(`l'un de tes héros`, `ton ${nomHeros}`),
    choix,
    heros: heros.classeId,
  };
}

/** Issue tirée pour un choix (ou null pour « partir » et les choix inconnus). */
export function tirerIssue(id, choixId, rng) {
  const option = RENCONTRES[id]?.choix.find((candidat) => candidat.id === choixId);
  const issues = option?.issues ?? [];
  if (!issues.length) {
    return null;
  }
  const total = issues.reduce((somme, issue) => somme + (issue.chance ?? 1), 0);
  let tirage = rng() * total;
  for (const issue of issues) {
    tirage -= issue.chance ?? 1;
    if (tirage < 0) {
      return issue;
    }
  }
  return issues.at(-1);
}

/** Paie le prix d'un choix ; false si la bourse ne suffit pas. */
export function payerChoix(run, id, choixId, toile) {
  const option = RENCONTRES[id]?.choix.find((candidat) => candidat.id === choixId);
  const prix = option ? prixChoix(option, toile) : 0;
  if (prix > run.kamas) {
    return false;
  }
  run.kamas -= prix;
  return true;
}

/**
 * Applique les effets d'une issue ; renvoie les lignes de texte du bilan. `heros` : le héros visé
 * par la rencontre (statistiques, nouveau sort), sinon un héros au hasard.
 */
export function appliquerEffetsLore(
  run,
  effets = {},
  { rng, toile = 1, heros = null, gains = [] },
) {
  const lignes = [];
  // `gains` reçoit `sort`, `apprendre` ou `relique` pour chaque récompense obtenue (Almanax)
  const cible =
    run.persos.find((perso) => perso.classeId === heros) ??
    choisir(herosDebout(run).length ? herosDebout(run) : run.persos, rng);
  if (effets.pertePvPct) {
    let perte = 0;
    for (const perso of run.persos) {
      if (perso.pvActuels > 0) {
        const avant = perso.pvActuels;
        perso.pvActuels = Math.max(
          1,
          Math.round(perso.pvActuels - pvMaxPerso(perso) * effets.pertePvPct),
        );
        perte += avant - perso.pvActuels;
      }
    }
    lignes.push(`💔 L'équipe perd ${perte} PV.`);
  }
  if (effets.soinPct) {
    const avant = run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);
    soignerEquipe(run, effets.soinPct);
    const apres = run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);
    lignes.push(`💤 L'équipe récupère ${apres - avant} PV.`);
  }
  if (effets.perteKamasPct) {
    const perte = Math.min(run.kamas, Math.round(run.kamas * effets.perteKamasPct));
    run.kamas -= perte;
    lignes.push(`💸 −${perte} kamas.`);
  }
  if (effets.kamas) {
    const gain = Math.max(1, Math.round(effets.kamas * gainBase(toile)));
    ajouterKamas(run, gain);
    lignes.push(`💰 +${gain} kamas.`);
  }
  if (effets.stats) {
    const valeur = Math.round(pointsStats(cible.progression?.niveau ?? 1) * effets.stats);
    lignes.push(
      appliquerChoix(run, { type: `bonus`, bonus: `stats`, heros: cible.classeId, valeur }),
    );
  }
  if (effets.xp) {
    const xp = Math.round(
      calculerXpCombat(XP_PAR_COMBAT.combat_dur, toile, run.trancheId) * effets.xp,
    );
    let gagne = false;
    for (const perso of run.persos) {
      gagne = gagnerXpPerso(perso, xp, run.trancheId) > 0 || gagne;
    }
    lignes.push(
      gagne ? `✨ +${xp} XP pour chaque héros.` : `✨ Tes héros n'ont plus rien à apprendre ici.`,
    );
  }
  // nouveau sort pour le héros visé, sinon une amélioration rare
  let amelioration = effets.amelioration;
  if (effets.apprendre) {
    const sort = sortsAApprendre(cible)[0];
    if (sort) {
      lignes.push(appliquerChoix(run, { type: `apprendre`, heros: cible.classeId, sort }));
      gains.push(`apprendre`);
    } else {
      amelioration ??= `rare`;
    }
  }
  if (amelioration) {
    const choix = tirerAmeliorationSort(run, rng, amelioration);
    if (choix) {
      lignes.push(appliquerChoix(run, choix));
      gains.push(`sort`);
    }
  }
  if (effets.relique) {
    const choix = tirerReliqueRun(run, rng, effets.relique);
    if (choix) {
      lignes.push(appliquerChoix(run, choix));
      gains.push(`relique`);
    } else {
      // toutes les reliques déjà prises : des kamas à la place
      const gain = Math.round(2 * gainBase(toile));
      ajouterKamas(run, gain);
      lignes.push(`💰 +${gain} kamas.`);
    }
  }
  if (effets.benediction && BENEDICTIONS[effets.benediction]) {
    const benediction = BENEDICTIONS[effets.benediction];
    if ((run.benedictions ?? []).includes(effets.benediction)) {
      const gain = Math.round(2 * gainBase(toile));
      ajouterKamas(run, gain);
      lignes.push(`✨ ${benediction.nom} est déjà active : +${gain} kamas à la place.`);
    } else {
      (run.benedictions ??= []).push(effets.benediction);
      lignes.push(`✨ ${benediction.nom} : ${benediction.desc} jusqu'à la fin de la run.`);
    }
  }
  if (effets.sacrificePv) {
    run.sacrificePv = Math.min(0.4, sacrificePvRun(run) + effets.sacrificePv);
    lignes.push(
      `🩸 Pacte de sang : −${Math.round(effets.sacrificePv * 100)} % de PV max en combat pour toute la run.`,
    );
  }
  return lignes.filter(Boolean);
}
