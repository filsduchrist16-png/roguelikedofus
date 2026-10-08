import { CLASSES, EQUIPEMENTS } from "../data/index.js";
import { DIFFICULTE_MAX } from "../jeu/config.js";
import { nouvellesStatsRun } from "../jeu/run.js";
const CLE_RUN = `rld_run_v0`;
export function sauverRun(zoneIdx, run) {
  try {
    localStorage.setItem(
      CLE_RUN,
      JSON.stringify({
        version: 2,
        zoneIdx,
        run,
      }),
    );
  } catch {}
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
const SLOTS_VALIDES = [`arme`, `coiffe`, `cape`, `anneau`];
const nombre = (x) => (typeof x === `number` && Number.isFinite(x) ? x : undefined);
function assainirObjet(inst) {
  const tiers = EQUIPEMENTS[inst.id].tiers ?? {};
  const rarete = Object.keys(tiers).includes(inst.rarete) ? inst.rarete : Object.keys(tiers)[0];
  const stats = {};
  for (const k of STATS_VALIDES) {
    if (nombre(inst.stats?.[k]) !== undefined) {
      stats[k] = inst.stats[k];
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
    for (const k of ELEMENTS_VALIDES) {
      if (nombre(inst.resistances[k]) !== undefined) {
        out.resistances[k] = inst.resistances[k];
      }
    }
  }
  return out;
}
export function chargerRun() {
  try {
    let e = localStorage.getItem(CLE_RUN);
    if (!e) {
      return null;
    }
    let t = JSON.parse(e);
    if (
      typeof t.version != `number` ||
      t.version < 1 ||
      t.version > 2 ||
      typeof t.zoneIdx != `number` ||
      !t.run?.persos?.length ||
      !t.run.persos.every((e) => CLASSES[e.classeId])
    ) {
      return null;
    }
    t.run.inventaire = (t.run.inventaire ?? [])
      .filter((e) => EQUIPEMENTS[e?.id])
      .map(assainirObjet);
    for (let e of t.run.persos) {
      for (let t of Object.keys(e.equipement ?? {})) {
        if (!SLOTS_VALIDES.includes(t) || !EQUIPEMENTS[e.equipement[t]?.id]) {
          delete e.equipement[t];
        } else {
          e.equipement[t] = assainirObjet(e.equipement[t]);
        }
      }
    }
    t.run.stats = t.run.stats ?? nouvellesStatsRun();
    t.run.stats.reliques ??= [];
    t.run.kamas = t.run.kamas ?? 0;
    t.run.ascension =
      t.version < 2 ? 0 : Math.max(0, Math.min(t.run.ascension ?? 0, DIFFICULTE_MAX));
    t.run.philtres = t.run.philtres ?? 0;
    t.run.trancheId = t.run.trancheId ?? `t1`;
    for (let e of t.run.carte?.noeuds ?? []) {
      let t = e.eliteModif;
      if (t && !e.eliteModifs) {
        e.eliteModifs = [t];
      }
    }
    return t;
  } catch {
    return null;
  }
}
export function effacerRun() {
  try {
    localStorage.removeItem(CLE_RUN);
  } catch {}
}
