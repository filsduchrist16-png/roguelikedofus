import { sauverMeta, dofusAGagner, ajouterDofus, dofusDebloquables } from "../sauvegarde/meta.js";
import { meta, quetesMeta, ctxMeta } from "./etat.js";
import {
  afficherBandeauQuete,
  ecranSuccesObtenu,
  ecranDofusDebloque,
} from "../ui/ecrans/succes.js";
import { decrireQuete } from "../jeu/obtention.js";
import { verifierQuetesMeta, trouverQuete } from "../jeu/quetes.js";
import { EMPLACEMENTS } from "../jeu/emplacements.js";

export async function traiterQuetes(run, verification) {
  sauverMeta(meta);
  if (!verification.quetes.length) {
    await donnerDofusEnAttente(run);
    return;
  }
  for (let quete of verification.quetes) {
    afficherBandeauQuete(decrireQuete(quete).titre);
    if (run) {
      (run.stats.quetes ??= []).push(quete.id);
    }
  }
  let dofusAjoute = false;
  for (let succes of verification.succes) {
    let idDofus = dofusAGagner(meta, succes.def);
    let obtenu = idDofus !== undefined;
    if (obtenu) {
      ajouterDofus(meta, idDofus);
      dofusAjoute = true;
    }
    await ecranSuccesObtenu(succes.def, obtenu, meta);
  }
  sauverMeta(meta);
  if (dofusAjoute) {
    await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  } else {
    await donnerDofusEnAttente(run);
  }
}
// Dofus dont le succès est terminé mais pas encore remis (anciennes sauvegardes), en cascade.
export async function donnerDofusEnAttente(run) {
  let ids = dofusDebloquables(meta);
  if (!ids.length) {
    return;
  }
  for (let id of ids) {
    ajouterDofus(meta, id);
    await ecranDofusDebloque(id);
  }
  sauverMeta(meta);
  await traiterQuetes(run, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
export function contexteRun(run, trancheId, victoire) {
  return {
    trancheId,
    victoire,
    ascension: run.ascension,
    tavernes: run.stats.tavernes ?? 0,
    recrutements: run.stats.recrutements ?? 0,
    tailleEquipe: run.persos.length,
    classes: run.persos.map((perso) => perso.classeId),
    quatreHerosEquipes:
      run.persos.length === 4 &&
      run.persos.every((perso) =>
        EMPLACEMENTS.every((emplacement) => perso.equipement[emplacement]),
      ),
  };
}
export const quetesDeLaRun = (run) =>
  (run.stats.quetes ?? [])
    .map((idQuete) => trouverQuete(idQuete))
    .filter((quete) => quete !== undefined);
