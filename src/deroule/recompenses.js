import {
  peutGagnerXp,
  gagnerXpPerso,
  tirerButin,
  multiplicateurKamas,
  soignerEquipe,
} from "../jeu/run.js";
import { capturerArchi, enregistrerCollection } from "../sauvegarde/meta.js";
import { meta, quetesMeta, ctxMeta } from "./etat.js";
import { MONSTRES } from "../data/index.js";
import { ecranCaptureArchi } from "../ui/ecrans/recompenses.js";
import { afficherBandeau } from "../ui/ecrans/succes.js";
import { bonusEquipeRun, idoleActive } from "../jeu/rencontres.js";
import { noterObjetsObtenus } from "../ui/ecrans/recap.js";
import { ecranButin } from "../ui/ecrans/butin.js";
import { gainKamas, ajouterKamas } from "../jeu/economie.js";
import { resoudreOffreCombat } from "../jeu/recompensesRun.js";
import { ecranApresCombat } from "../ui/ecrans/apresCombat.js";
import { traiterQuetes } from "./quetes.js";
import { verifierQuetesMeta } from "../jeu/quetes.js";
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
// Tire le butin d'un combat et le range dans l'inventaire, sans rien afficher.
export function preparerButin(run, zoneId, type, typeTaux) {
  if (!zoneId) {
    return [];
  }
  let prospection =
    bonusEquipeRun(meta, run).prospection + (idoleActive(run, zoneId)?.prospection ?? 0);
  let objets = tirerButin(run, zoneId, type, Math.random, typeTaux, prospection);
  enregistrerCollection(meta, objets);
  run.stats.objets += objets.length;
  noterObjetsObtenus(run.stats, objets);
  return objets;
}
// bilan : texte XP / kamas du combat, en sous-titre du butin (ou en bandeau s'il n'y a rien).
export async function distribuerButin(run, zoneId, type, typeTaux, bilan) {
  let objets = preparerButin(run, zoneId, type, typeTaux);
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
// Après un combat normal ou élite : butin et choix de récompense sur un seul écran. Tout est déjà
// rangé dans la run (objets dans l'inventaire, `butinCombat`, `offreCombat`) et la case marquée
// visitée par jouerZone : la run est sauvegardée avant l'affichage, un rechargement remontre le même
// écran sans rejouer le combat ni relancer le tirage.
export async function proposerOffreCombat(run, zoneIdx) {
  if (!run.offreCombat?.choix?.length) {
    run.offreCombat = null;
  }
  const butin = run.butinCombat;
  if (!run.offreCombat && !butin) {
    return;
  }
  sauverRun(zoneIdx, run);
  let texte = ``;
  if (run.offreCombat) {
    const indice = await ecranApresCombat(
      { objets: butin?.objets ?? [], bilan: butin?.bilan ?? ``, cle: !!butin?.cle },
      run.offreCombat,
      run,
    );
    texte = resoudreOffreCombat(run, indice);
  } else if (butin.objets.length) {
    await ecranButin(butin.objets, run, butin.bilan);
  } else if (butin.bilan) {
    afficherBandeau(`Victoire : ${butin.bilan}`);
  }
  run.butinCombat = null;
  sauverRun(zoneIdx, run);
  if (texte) {
    afficherBandeau(texte);
  }
  // quêtes liées au butin (collection) : après l'écran, pour ne pas l'interrompre
  await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
