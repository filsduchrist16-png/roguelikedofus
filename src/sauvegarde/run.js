import { signalerEchecSauvegarde } from "./echec.js";
import { signalerChangement } from "./nuage.js";
import { CLASSES, EQUIPEMENTS, MONDES } from "../data/index.js";
import { DIFFICULTE_MAX, getMonde, zonesDuMonde } from "../jeu/config.js";
import { nouvellesStatsRun } from "../jeu/run.js";
import { idolesDepartValides } from "../jeu/idolesDepart.js";
import { EMPLACEMENTS, emplacementsDuType } from "../jeu/emplacements.js";
import { MODE_SONGES, runSongesValide } from "../jeu/songes.js";
import { assainirChoix, assainirRecompensesRun } from "../jeu/recompensesRun.js";
const CLE_RUN = `rld_run_v0`;
/** Enregistre la run. Renvoie false (et prévient une fois) si le navigateur refuse d'écrire. */
export function sauverRun(zoneIdx, run) {
  let ecrit = true;
  try {
    localStorage.setItem(
      CLE_RUN,
      JSON.stringify({
        version: 2,
        zoneIdx,
        run,
      }),
    );
  } catch {
    ecrit = false;
    signalerEchecSauvegarde();
  }
  signalerChangement();
  return ecrit;
}
// Une sauvegarde importée peut venir de n'importe où : on ne garde que des champs connus et des
// nombres (les clés et la rareté finissent dans le HTML de l'inventaire).
const STATS_VALIDES = [
  `force`,
  `intelligence`,
  `agilite`,
  `chance`,
  `vitalite`,
  `soin`,
  `prospection`,
  `crit`,
];
const ELEMENTS_VALIDES = [`terre`, `feu`, `eau`, `air`];
const nombre = (valeur) =>
  typeof valeur === `number` && Number.isFinite(valeur) ? valeur : undefined;
function assainirObjet(inst) {
  const tiers = EQUIPEMENTS[inst.id].tiers ?? {};
  const rarete = Object.keys(tiers).includes(inst.rarete) ? inst.rarete : Object.keys(tiers)[0];
  const stats = {};
  for (const stat of STATS_VALIDES) {
    if (nombre(inst.stats?.[stat]) !== undefined) {
      stats[stat] = inst.stats[stat];
    }
  }
  const out = { id: inst.id, rarete, stats };
  if (nombre(inst.adaptatif) !== undefined) {
    out.adaptatif = inst.adaptatif;
  }
  if (nombre(inst.pa) !== undefined) {
    out.pa = inst.pa;
  }
  if (inst.resistances && typeof inst.resistances === `object`) {
    out.resistances = {};
    for (const element of ELEMENTS_VALIDES) {
      if (nombre(inst.resistances[element]) !== undefined) {
        out.resistances[element] = inst.resistances[element];
      }
    }
  }
  return out;
}
// Récompenses en attente et palier d'une run de songes : abîmés, ils sont simplement oubliés.
const TYPES_RECOMPENSE = [`objet`, `soin`, `kamas`, `amelioration`, `sort`, `relique`];
function assainirSonges(run) {
  const offre = Array.isArray(run.offreSonge)
    ? run.offreSonge
        .filter((recompense) => TYPES_RECOMPENSE.includes(recompense?.type))
        .map((recompense) =>
          // amélioration de sort et relique de run : même format que le choix après un combat
          recompense.type === `sort` || recompense.type === `relique`
            ? assainirChoix(recompense)
            : recompense.type === `objet`
              ? {
                  type: `objet`,
                  objet: EQUIPEMENTS[recompense.objet?.id] ? assainirObjet(recompense.objet) : null,
                }
              : recompense.type === `kamas`
                ? {
                    type: `kamas`,
                    montant: Math.max(0, Math.round(nombre(recompense.montant) ?? 0)),
                  }
                : recompense.type === `soin`
                  ? {
                      type: `soin`,
                      pct: Math.min(1, Math.max(0, nombre(recompense.pct) ?? 0.5)),
                      releve: Math.min(1, Math.max(0, nombre(recompense.releve) ?? 0.3)),
                    }
                  : {
                      type: `amelioration`,
                      ...(typeof recompense.benediction === `string`
                        ? { benediction: recompense.benediction }
                        : { forge: true }),
                    },
        )
        .filter((recompense) => recompense && (recompense.type !== `objet` || recompense.objet))
        .slice(0, 3)
    : [];
  run.offreSonge = offre.length ? offre : null;
  run.palierSonge =
    run.palierSonge && typeof run.palierSonge === `object`
      ? { taverne: !!run.palierSonge.taverne, hdv: !!run.palierSonge.hdv }
      : null;
}
export function chargerRun() {
  try {
    let brut = localStorage.getItem(CLE_RUN);
    if (!brut) {
      return null;
    }
    let sauvegarde = JSON.parse(brut);
    if (
      typeof sauvegarde.version !== `number` ||
      sauvegarde.version < 1 ||
      sauvegarde.version > 2 ||
      !Number.isInteger(sauvegarde.zoneIdx) ||
      sauvegarde.zoneIdx < 0 ||
      !MONDES.some((monde) => monde.id === (sauvegarde.run?.trancheId ?? `t1`)) ||
      sauvegarde.zoneIdx >= zonesDuMonde(getMonde(sauvegarde.run?.trancheId ?? `t1`)).length ||
      !sauvegarde.run?.persos?.length ||
      !sauvegarde.run.persos.every((perso) => CLASSES[perso.classeId])
    ) {
      return null;
    }
    // Songes infinis : seul mode connu ; une run sans `mode` reste une run normale
    if (sauvegarde.run.mode !== undefined && !runSongesValide(sauvegarde.run)) {
      return null;
    }
    sauvegarde.run.inventaire = (sauvegarde.run.inventaire ?? [])
      .filter((objet) => EQUIPEMENTS[objet?.id])
      .map(assainirObjet);
    for (let perso of sauvegarde.run.persos) {
      perso.equipement ??= {};
      for (let emplacement of Object.keys(perso.equipement)) {
        const inst = perso.equipement[emplacement];
        const def = EQUIPEMENTS[inst?.id];
        if (!EMPLACEMENTS.includes(emplacement) || !def) {
          delete perso.equipement[emplacement];
        } else if (!emplacementsDuType(def.slot).includes(emplacement)) {
          // objet dont l'emplacement a changé : il retourne dans l'inventaire
          sauvegarde.run.inventaire.push(assainirObjet(inst));
          delete perso.equipement[emplacement];
        } else {
          perso.equipement[emplacement] = assainirObjet(inst);
        }
      }
    }
    sauvegarde.run.stats = sauvegarde.run.stats ?? nouvellesStatsRun();
    sauvegarde.run.stats.reliques ??= [];
    sauvegarde.run.kamas = sauvegarde.run.kamas ?? 0;
    sauvegarde.run.ascension =
      sauvegarde.version < 2
        ? 0
        : Math.max(0, Math.min(sauvegarde.run.ascension ?? 0, DIFFICULTE_MAX));
    sauvegarde.run.philtres = sauvegarde.run.philtres ?? 0;
    // ancienne sauvegarde sans idoles de départ : aucune
    sauvegarde.run.idolesDepart = idolesDepartValides(sauvegarde.run.idolesDepart);
    sauvegarde.run.trancheId = sauvegarde.run.trancheId ?? `t1`;
    for (let noeud of sauvegarde.run.carte?.noeuds ?? []) {
      let modif = noeud.eliteModif;
      if (modif && !noeud.eliteModifs) {
        noeud.eliteModifs = [modif];
      }
    }
    // améliorations de sort, reliques de run et choix de récompense en attente (absents = vides)
    assainirRecompensesRun(sauvegarde.run);
    if (sauvegarde.run.mode === MODE_SONGES) {
      assainirSonges(sauvegarde.run);
    }
    return sauvegarde;
  } catch {
    return null;
  }
}
export function effacerRun() {
  try {
    localStorage.removeItem(CLE_RUN);
  } catch {}
  signalerChangement();
}
