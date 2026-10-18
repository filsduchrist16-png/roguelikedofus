import {
  peutGagnerXp,
  gagnerXpPerso,
  tirerButin,
  multiplicateurKamas,
  soignerEquipe,
} from "../jeu/run.js";
import { capturerArchi, enregistrerCollection } from "../sauvegarde/meta.js";
import { meta } from "./etat.js";
import { MONSTRES } from "../data/index.js";
import { ecranCaptureArchi } from "../ui/ecrans/recompenses.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { bonusEquipeRun, idoleActive } from "../jeu/rencontres.js";
import { noterObjetsObtenus } from "../ui/ecrans/recap.js";
import { ecranButin } from "../ui/ecrans/butin.js";
import { gainKamas, ajouterKamas } from "../jeu/economie.js";
import { resoudreOffreCombat } from "../jeu/recompensesRun.js";
import { ecranChoixRecompense } from "../ui/ecrans/choixRecompense.js";
import { sauverRun } from "../sauvegarde/run.js";

// Renvoie l'XP donnée à chaque héros (0 si tous sont au niveau max du monde)
// et le nombre de héros qui ont gagné au moins un niveau.
export function gagnerXpEquipe(run, xp) {
  let niveaux = 0;
  const profite = run.persos.some((perso) => peutGagnerXp(perso, run.trancheId));
  for (let perso of run.persos) {
    if (gagnerXpPerso(perso, xp, run.trancheId) > 0) {
      perso.flashNiveau = true;
      niveaux += 1;
    }
  }
  return { xp: profite ? xp : 0, niveaux };
}
export async function capturerArchis(combattants) {
  let noms = [];
  for (let combattant of combattants) {
    if (
      combattant.camp === `ennemi` &&
      combattant.archi &&
      combattant.monstreId &&
      capturerArchi(meta, combattant.monstreId)
    ) {
      noms.push(MONSTRES[combattant.monstreId]?.nom ?? combattant.monstreId);
    }
  }
  if (noms.length) {
    await ecranCaptureArchi(noms);
  }
  return noms.length;
}
// bilan : texte XP / kamas du combat, en sous-titre du butin (ou en bandeau s'il n'y a rien).
export async function distribuerButin(run, zoneId, type, typeTaux, bilan) {
  if (!zoneId) {
    if (bilan) {
      afficherBandeau(`Victoire : ${bilan}`);
    }
    return;
  }
  let prospection =
    bonusEquipeRun(meta, run).prospection + (idoleActive(run, zoneId)?.prospection ?? 0);
  let objets = tirerButin(run, zoneId, type, Math.random, typeTaux, prospection);
  enregistrerCollection(meta, objets);
  run.stats.objets += objets.length;
  noterObjetsObtenus(run.stats, objets);
  if (objets.length) {
    await ecranButin(objets, run, bilan);
  } else if (bilan) {
    afficherBandeau(`Victoire : ${bilan}`);
  }
}
// Renvoie le montant ajouté à la bourse.
export function distribuerKamas(run, type, numZone, mult = 1) {
  let montant = Math.round(
    gainKamas(type, numZone, Math.random) *
      multiplicateurKamas(run) *
      bonusEquipeRun(meta, run).multKamas *
      mult,
  );
  ajouterKamas(run, montant);
  return montant;
}
// Soigne l'équipe et renvoie le total de PV rendus.
export function soignerAvecGain(run, pct) {
  let avant = run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0);
  soignerEquipe(run, pct);
  return run.persos.reduce((somme, perso) => somme + Math.max(0, perso.pvActuels), 0) - avant;
}
// Choix de récompense en attente (après un combat normal ou élite) : la run est sauvegardée avec
// l'offre avant de l'afficher, pour qu'un rechargement propose exactement les mêmes cartes.
export async function proposerOffreCombat(run, zoneIdx) {
  if (!run.offreCombat?.choix?.length) {
    run.offreCombat = null;
    return;
  }
  sauverRun(zoneIdx, run);
  const indice = await ecranChoixRecompense(run.offreCombat, run);
  const texte = resoudreOffreCombat(run, indice);
  sauverRun(zoneIdx, run);
  if (texte) {
    afficherBandeau(texte);
  }
}
