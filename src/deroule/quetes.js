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

export async function traiterQuetes(e, t) {
  sauverMeta(meta);
  if (!t.quetes.length) {
    await donnerDofusEnAttente(e);
    return;
  }
  for (let n of t.quetes) {
    afficherBandeauQuete(decrireQuete(n).titre);
    if (e) {
      (e.stats.quetes ??= []).push(n.id);
    }
  }
  let n = false;
  for (let e of t.succes) {
    let t = dofusAGagner(meta, e.def);
    let r = t !== undefined;
    if (r) {
      ajouterDofus(meta, t);
      n = true;
    }
    await ecranSuccesObtenu(e.def, r, meta);
  }
  sauverMeta(meta);
  if (n) {
    await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
  } else {
    await donnerDofusEnAttente(e);
  }
}
// Dofus dont le succès est terminé mais pas encore remis (anciennes sauvegardes), en cascade.
export async function donnerDofusEnAttente(e) {
  let ids = dofusDebloquables(meta);
  if (!ids.length) {
    return;
  }
  for (let id of ids) {
    ajouterDofus(meta, id);
    await ecranDofusDebloque(id);
  }
  sauverMeta(meta);
  await traiterQuetes(e, verifierQuetesMeta(quetesMeta(), ctxMeta()));
}
export function contexteRun(e, trancheId, victoire) {
  return {
    trancheId,
    victoire,
    ascension: e.ascension,
    tavernes: e.stats.tavernes ?? 0,
    recrutements: e.stats.recrutements ?? 0,
    tailleEquipe: e.persos.length,
    classes: e.persos.map((e) => e.classeId),
    quatreHerosEquipes:
      e.persos.length === 4 && e.persos.every((e) => EMPLACEMENTS.every((t) => e.equipement[t])),
  };
}
export const quetesDeLaRun = (e) =>
  (e.stats.quetes ?? []).map((e) => trouverQuete(e)).filter((e) => e !== undefined);
