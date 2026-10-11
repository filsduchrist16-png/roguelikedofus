import { signalerChangement } from "./nuage.js";
import { CONFIG_RELIQUES, DOFUS, MONDES, MONSTRES, RELIQUES, SUCCES } from "../data/index.js";
import { DIFFICULTES, RARETES, getMonde } from "../jeu/config.js";
import { dofusDeSucces, nouvelEtatQuetes, progressionSucces } from "../jeu/quetes.js";
import { ajouterResistanceTous, effetsDifficulte, prospectionEquipe } from "../jeu/run.js";
const CLE_META = `rld_meta_v0`;
const MIGRATION_SUCCES = {
  bapteme_du_feu: `g_premiere_run`,
  veteran: `g_dix_runs`,
  tour_du_monde: `g_tranche1`,
  quatre_par_quatre: `g_quatre_equipes`,
  collectionneur: `g_archis_10`,
  chasseur_dames: `g_archis_25`,
  zoologiste: `g_zone_archis`,
  chasseur_de_reliques: `g_premier_dofus`,
  asc_difficile: `g_asc_difficile`,
  asc_extreme: `g_asc_extreme`,
  asc_cauchemar: `g_asc_cauchemar`,
  asc_ultime: `g_asc_ultime`,
};
export function chargerMeta() {
  try {
    let e = localStorage.getItem(CLE_META);
    if (e) {
      let t = JSON.parse(e);
      let n =
        t.ascension ??
        ((t.victoires ?? 0) > 0
          ? {
              t1: 0,
            }
          : undefined);
      let r = (t.version ?? 0) < 2;
      let ascension = n && (r ? Object.fromEntries(Object.keys(n).map((e) => [e, 0])) : n);
      let dofus = Array.isArray(t.dofus)
        ? t.dofus.map((e) => {
            if (typeof e == `string`) {
              return { id: e };
            }
            return e;
          })
        : [];
      let quetes = {
        faites: Array.isArray(t.quetes?.faites) ? [...t.quetes.faites] : [],
        compteurs: {
          ...(t.quetes?.compteurs ?? {}),
        },
      };
      if ((t.version ?? 0) < 4) {
        for (let e of t.succes ?? []) {
          let t = MIGRATION_SUCCES[e];
          if (t && !quetes.faites.includes(t)) {
            quetes.faites.push(t);
          }
        }
      }
      // Validation robuste champ par champ (A2)
      const dofusValides = Array.isArray(dofus)
        ? dofus.filter((d) => d && DOFUS[d.id])
        : [];
      const archisValides = Array.isArray(t.archis)
        ? t.archis.filter((a) => typeof a === "string")
        : [];
      const quetesFaites = Array.isArray(quetes.faites)
        ? quetes.faites.filter((q) => typeof q === "string")
        : [];

      return {
        version: 4,
        dofus: dofusValides,
        archis: archisValides,
        runs: Number.isFinite(t.runs) ? t.runs : 0,
        victoires: Number.isFinite(t.victoires) ? t.victoires : 0,
        quetes: {
          faites: quetesFaites,
          compteurs: quetes.compteurs && typeof quetes.compteurs === "object" ? quetes.compteurs : {},
        },
        // raretés connues seulement (elles finissent dans des classes CSS)
        collection: Object.fromEntries(
          Object.entries(t.collection ?? {}).filter(([, r]) => RARETES.includes(r)),
        ),
        ascension,
        statsMonde: normaliserStatsMonde(t.statsMonde),
        reliques: normaliserReliques(t.reliques),
        dofusSuspendus: Array.isArray(t.dofusSuspendus) ? t.dofusSuspendus : [],
        secrets: Array.isArray(t.secrets) ? t.secrets : [],
        jaugeArchi: Number.isFinite(t.jaugeArchi) ? Math.max(0, t.jaugeArchi) : 0,
      };
    }
  } catch (err) {
    // Conserver la donnée brute en cas de corruption (A2)
    try {
      const raw = localStorage.getItem(CLE_META);
      if (raw) localStorage.setItem("rld_meta_corrompue_v0", raw);
    } catch {}
    console.error("Meta corrompue, reset partiel :", err);
  }
  return {
    version: 4,
    dofus: [],
    archis: [],
    runs: 0,
    victoires: 0,
    quetes: nouvelEtatQuetes(),
    collection: {},
  };
}
export function sauverMeta(e) {
  try {
    localStorage.setItem(CLE_META, JSON.stringify(e));
  } catch {}
  signalerChangement();
}
