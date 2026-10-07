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
    t.run.inventaire = (t.run.inventaire ?? []).filter((e) => EQUIPEMENTS[e.id]);
    for (let e of t.run.persos) {
      for (let t of Object.keys(e.equipement ?? {})) {
        e.equipement[t] && !EQUIPEMENTS[e.equipement[t].id] && delete e.equipement[t];
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
