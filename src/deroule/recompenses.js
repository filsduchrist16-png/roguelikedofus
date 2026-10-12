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

// Renvoie l'XP donnée à chaque héros (0 si tous sont au niveau max du monde)
// et le nombre de héros qui ont gagné au moins un niveau.
export function gagnerXpEquipe(e, t) {
  let niveaux = 0;
  const profite = e.persos.some((p) => peutGagnerXp(p, e.trancheId));
  for (let n of e.persos) {
    if (gagnerXpPerso(n, t, e.trancheId) > 0) {
      n.flashNiveau = true;
      niveaux += 1;
    }
  }
  return { xp: profite ? t : 0, niveaux };
}
export async function capturerArchis(e) {
  let t = [];
  for (let n of e) {
    if (n.camp === `ennemi` && n.archi && n.monstreId && capturerArchi(meta, n.monstreId)) {
      t.push(MONSTRES[n.monstreId]?.nom ?? n.monstreId);
    }
  }
  if (t.length) {
    await ecranCaptureArchi(t);
  }
  return t.length;
}
// bilan : texte XP / kamas du combat, en sous-titre du butin (ou en bandeau s'il n'y a rien).
export async function distribuerButin(e, t, n, r, bilan) {
  if (!t) {
    if (bilan) {
      afficherBandeau(`Victoire : ${bilan}`);
    }
    return;
  }
  let prospection = bonusEquipeRun(meta, e).prospection + (idoleActive(e, t)?.prospection ?? 0);
  let a = tirerButin(e, t, n, Math.random, r, prospection);
  enregistrerCollection(meta, a);
  e.stats.objets += a.length;
  noterObjetsObtenus(e.stats, a);
  if (a.length) {
    await ecranButin(a, e, bilan);
  } else if (bilan) {
    afficherBandeau(`Victoire : ${bilan}`);
  }
}
// Renvoie le montant ajouté à la bourse.
export function distribuerKamas(e, t, n, mult = 1) {
  let montant = Math.round(
    gainKamas(t, n, Math.random) *
      multiplicateurKamas(e) *
      bonusEquipeRun(meta, e).multKamas *
      mult,
  );
  ajouterKamas(e, montant);
  return montant;
}
// Soigne l'équipe et renvoie le total de PV rendus.
export function soignerAvecGain(e, pct) {
  let avant = e.persos.reduce((s, p) => s + Math.max(0, p.pvActuels), 0);
  soignerEquipe(e, pct);
  return e.persos.reduce((s, p) => s + Math.max(0, p.pvActuels), 0) - avant;
}
