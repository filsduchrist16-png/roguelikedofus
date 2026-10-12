import { signalerEchecSauvegarde } from "./echec.js";
import { signalerChangement } from "./nuage.js";
import { CONFIG_RELIQUES, DOFUS, MONDES, RELIQUES, SUCCES } from "../data/index.js";
import { DIFFICULTES, RARETES, bonusRelique, getMonde } from "../jeu/config.js";
import { dofusDeSucces, nouvelEtatQuetes, progressionSucces } from "../jeu/quetes.js";
import { ajouterResistanceTous, effetsDifficulte, prospectionEquipe } from "../jeu/run.js";
import { idolesDepartValides } from "../jeu/idolesDepart.js";
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
const CLE_META_CORROMPUE = `rld_meta_corrompue_v0`;
const metaVierge = () => ({
  version: 4,
  dofus: [],
  archis: [],
  runs: 0,
  victoires: 0,
  quetes: nouvelEtatQuetes(),
  collection: {},
});
export function chargerMeta() {
  let brut = null;
  try {
    brut = localStorage.getItem(CLE_META);
    if (brut) {
      let t = JSON.parse(brut);
      if (!t || typeof t !== `object` || Array.isArray(t)) {
        throw new Error(`méta illisible`);
      }
      let n =
        t.ascension ??
        ((t.victoires ?? 0) > 0
          ? {
              t1: 0,
            }
          : undefined);
      let r = (t.version ?? 0) < 2;
      let ascension = n && (r ? Object.fromEntries(Object.keys(n).map((e) => [e, 0])) : n);
      // champ par champ : une valeur abîmée ne fait pas perdre les autres
      let dofus = (Array.isArray(t.dofus) ? t.dofus : [])
        .map((e) => (typeof e === `string` ? { id: e } : e))
        .filter((e) => e && typeof e === `object` && DOFUS[e.id]);
      let quetes = {
        faites: Array.isArray(t.quetes?.faites)
          ? t.quetes.faites.filter((x) => typeof x === `string`)
          : [],
        compteurs: {
          ...(t.quetes?.compteurs && typeof t.quetes.compteurs === `object`
            ? t.quetes.compteurs
            : {}),
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
      return {
        version: 4,
        dofus,
        archis: Array.isArray(t.archis) ? t.archis.filter((x) => typeof x === `string`) : [],
        runs: Number.isFinite(t.runs) ? t.runs : 0,
        victoires: Number.isFinite(t.victoires) ? t.victoires : 0,
        quetes,
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
        records: normaliserRecords(t.records),
        // relique équipée (E2) : absente = aucune
        reliqueEquipee:
          typeof t.reliqueEquipee === `string` && RELIQUES[t.reliqueEquipee]
            ? t.reliqueEquipee
            : undefined,
      };
    }
  } catch {
    // illisible : on garde une copie de la donnée brute avant qu'elle soit remplacée
    try {
      if (brut) {
        localStorage.setItem(CLE_META_CORROMPUE, brut);
      }
    } catch {}
  }
  return metaVierge();
}
/** Enregistre la méta-progression. Renvoie false (et prévient une fois) si l'écriture échoue. */
export function sauverMeta(e) {
  let ecrit = true;
  try {
    localStorage.setItem(CLE_META, JSON.stringify(e));
  } catch {
    ecrit = false;
    signalerEchecSauvegarde();
  }
  signalerChangement();
  return ecrit;
}
// ---------- Dofus : chacun dans la tranche de niveau de son monde ----------
// Chaque Dofus s'obtient dès que son succès est terminé, sans attendre ceux de niveau inférieur :
// le niveau réel de Dofus 3 décide seulement du monde où se trouvent ses quêtes.
const succesDuDofusId = (id) => Object.values(SUCCES).find((s) => dofusDeSucces(s) === id);
// Dofus dont le succès est terminé mais pas encore remis (ancienne sauvegarde, ou cascade).
export function dofusEnAttente(meta) {
  const possedes = new Set(meta.dofus.map((d) => d.id));
  return Object.values(DOFUS)
    .filter((d) => !possedes.has(d.id))
    .filter((d) => {
      const s = succesDuDofusId(d.id);
      return s && meta.quetes && progressionSucces(meta.quetes, s).complet;
    })
    .map((d) => d.id);
}
export function dofusDebloquables(meta) {
  return dofusEnAttente(meta).sort((a, b) => DOFUS[a].niveau - DOFUS[b].niveau);
}
// Anciennes versions : des Dofus avaient été mis de côté pour respecter un ordre strict. Ils
// reviennent tous, avec leur jet.
export function rendreDofusSuspendus(meta) {
  const suspendus = (meta.dofusSuspendus ?? []).filter(
    (d) => DOFUS[d.id] && !meta.dofus.some((x) => x.id === d.id),
  );
  if (meta.dofusSuspendus?.length) {
    meta.dofus.push(...suspendus);
    meta.dofusSuspendus = [];
    sauverMeta(meta);
  }
  return suspendus.map((d) => d.id);
}
export function ajouterDofus(e, t, n = Math.random) {
  // un Dofus mis de côté retrouve son jet
  let ancien = (e.dofusSuspendus ?? []).find((d) => d.id === t);
  if (ancien) {
    e.dofusSuspendus = e.dofusSuspendus.filter((d) => d !== ancien);
    e.dofus.push(ancien);
    sauverMeta(e);
    return;
  }
  let r = DOFUS[t]?.prospectionJet;
  let jet = r ? r[0] + Math.floor(n() * (r[1] - r[0] + 1)) : undefined;
  e.dofus.push(
    jet === undefined
      ? {
          id: t,
        }
      : {
          id: t,
          jet,
        },
  );
  sauverMeta(e);
}
export function dofusAGagner(e, t) {
  let n = dofusDeSucces(t);
  if (n && !e.dofus.some((e) => e.id === n)) {
    return n;
  }
}
/**
 * Efface les Dofus ET les quêtes des succès de Dofus : sinon ils reviendraient aussitôt (leur succès
 * resterait terminé) et le Kaliptus pourrait être retiré à volonté.
 */
export function reinitialiserDofus(e) {
  e.dofus = [];
  e.dofusSuspendus = [];
  const ids = new Set(
    Object.values(SUCCES)
      .filter((s) => s.categorie?.dofus)
      .flatMap((s) => s.quetes.map((q) => q.id)),
  );
  e.quetes.faites = e.quetes.faites.filter((id) => !ids.has(id));
  for (const id of ids) {
    delete e.quetes.compteurs[id];
  }
  sauverMeta(e);
}
export function enregistrerRun(e, t, n) {
  e.runs += 1;
  if (t) {
    e.victoires += 1;
    if (n) {
      statsMondeModifiable(e, n).victoires += 1;
    }
  }
  sauverMeta(e);
}
export function statsMonde(e, t) {
  let n = e.statsMonde?.[t];
  return {
    toileMax: n?.toileMax ?? 0,
    victoires: n?.victoires ?? 0,
  };
}
function statsMondeModifiable(e, t) {
  e.statsMonde ??= {};
  return (e.statsMonde[t] ??= {
    toileMax: 0,
    victoires: 0,
  });
}
export function enregistrerToileMax(e, t, n) {
  let r = statsMondeModifiable(e, t);
  r.toileMax = Math.max(r.toileMax, n);
}
// Score record par monde (runs avec ou sans idoles de départ) : { score, idoles, ascension }.
function normaliserRecords(records) {
  const out = {};
  if (!records || typeof records !== `object` || Array.isArray(records)) {
    return out;
  }
  for (const [monde, r] of Object.entries(records)) {
    if (r && typeof r === `object` && Number.isFinite(r.score) && r.score > 0) {
      out[monde] = {
        score: Math.floor(r.score),
        idoles: idolesDepartValides(r.idoles),
        ascension: Number.isFinite(r.ascension) ? Math.max(0, Math.floor(r.ascension)) : 0,
      };
    }
  }
  return out;
}
export function recordMonde(e, t) {
  return e.records?.[t];
}
/** Garde le score s'il bat le record du monde. Renvoie true si c'est un nouveau record. */
export function enregistrerRecord(e, t, score, idoles = [], ascension = 0) {
  if (!(score > (e.records?.[t]?.score ?? 0))) {
    return false;
  }
  e.records = {
    ...(e.records ?? {}),
    [t]: { score, idoles: idolesDepartValides(idoles), ascension },
  };
  sauverMeta(e);
  return true;
}
export function chanceRelique(e, t) {
  return (
    (CONFIG_RELIQUES.base + CONFIG_RELIQUES.parCran * e) *
    (1 + Math.max(0, t - 100) / CONFIG_RELIQUES.diviseurProspection)
  );
}
export function prospectionMoyenne(e, t = 0) {
  if (e.persos.length) {
    return (prospectionEquipe(e) + t) / e.persos.length;
  }
  return 0;
}
export function tirerReliques(e, t, n, r, i) {
  let a = chanceRelique(n, r);
  let o = [];
  for (let n of t) {
    !RELIQUES[n] || e.reliques?.includes(n) || o.includes(n) || (i() < a && o.push(n));
  }
  if (o.length) {
    e.reliques = [...(e.reliques ?? []), ...o];
  }
  return o;
}
function normaliserReliques(reliques) {
  if (Array.isArray(reliques)) {
    return [...new Set(reliques.filter((e) => typeof e === `string` && !!RELIQUES[e]))];
  }
  return [];
}
function normaliserStatsMonde(statsMonde) {
  let t = {};
  if (!statsMonde || typeof statsMonde !== `object`) {
    return t;
  }
  let n = (e) => {
    if (typeof e === `number` && Number.isFinite(e) && e > 0) {
      return Math.floor(e);
    }
    return 0;
  };
  for (let [r, i] of Object.entries(statsMonde)) {
    let e = i && typeof i === `object` ? i : {};
    t[r] = {
      toileMax: n(e.toileMax),
      victoires: n(e.victoires),
    };
  }
  return t;
}
export function pctSoinTaverne(e) {
  return effetsDifficulte(e).tavernePct ?? 0.5;
}
export function ascensionMonde(e, t) {
  return e.ascension?.[t];
}
export function enregistrerAscension(e, t, n) {
  e.ascension = {
    ...(e.ascension ?? {}),
    [t]: Math.max(e.ascension?.[t] ?? 0, n),
  };
  sauverMeta(e);
}
if (DIFFICULTES.findIndex((e) => e.id === `cauchemar`) < 0) {
  throw Error(`PALIER_CAUCHEMAR : aucun palier "cauchemar" dans ASCENSION — table incohérente.`);
}
export function mondePrecedentTermine(e, t) {
  let n = MONDES.findIndex((e) => e.id === t);
  if (n <= 0) {
    return n === 0;
  }
  return ascensionMonde(e, MONDES[n - 1].id) !== undefined;
}
export function mondeJouable(e, t) {
  let n = getMonde(t);
  return mondePrecedentTermine(e, t) && n.zones.length > 0 && !n.enChantier;
}
/** Équipe une relique obtenue (ou la retire avec null). Renvoie false si on ne la possède pas. */
export function equiperRelique(meta, id) {
  if (id !== null && !(meta.reliques ?? []).includes(id)) {
    return false;
  }
  meta.reliqueEquipee = id ?? undefined;
  sauverMeta(meta);
  return true;
}
export function dofusPossedes(e) {
  return new Set(e.dofus.map((e) => e.id));
}
function meilleurJetDofus(e, t) {
  let n = e.dofus.filter((e) => e.id === t && e.jet !== undefined).map((e) => e.jet);
  if (n.length) {
    return Math.max(...n);
  }
}
const RARETES_ORDRE = [...RARETES];
export function enregistrerCollection(e, t) {
  if (!t.length) {
    return;
  }
  let n = (e.collection ??= {});
  let r = false;
  for (let e of t) {
    let t = e.rarete;
    if (!t) {
      continue;
    }
    let i = n[e.id];
    if (!i || RARETES_ORDRE.indexOf(t) > RARETES_ORDRE.indexOf(i)) {
      n[e.id] = t;
      r = true;
    }
  }
  if (r) {
    sauverMeta(e);
  }
}
export function capturerArchi(e, t) {
  if (e.archis.includes(t)) {
    return false;
  }
  return (e.archis.push(t), sauverMeta(e), true);
}
export function bonusDofus(e) {
  let t = {
    damageMult: 1,
    paBonus: 0,
    pvBonus: 0,
    resAllBonus: 0,
    statsElementaires: 0,
    critPlat: 0,
    perceResistances: 0,
    prospection: 0,
    ouvreToujours: false,
    pvPct: 0,
    multKamas: 1,
    bouclierDebutPct: 0,
    initiativeBonus: 0,
    esquiveBonus: 0,
    soinPlat: 0,
  };
  for (let n of dofusPossedes(e)) {
    let r = DOFUS[n];
    r &&
      (r.degatsPct && (t.damageMult *= 1 + r.degatsPct),
      r.paBonus && (t.paBonus += r.paBonus),
      r.pvBonus && (t.pvBonus += r.pvBonus),
      r.resAll && (t.resAllBonus += r.resAll),
      r.statsElementaires && (t.statsElementaires += r.statsElementaires),
      r.critPlat && (t.critPlat += r.critPlat),
      r.perceResistances && (t.perceResistances += r.perceResistances),
      r.prospectionJet && (t.prospection += meilleurJetDofus(e, n) ?? 0),
      n === `dofus_du_cauchemar` && (t.ouvreToujours = true));
    if (r) {
      t.pvPct += r.pvPct ?? 0;
      t.multKamas *= r.multKamas ?? 1;
      t.prospection += r.prospectionPlat ?? 0;
      t.bouclierDebutPct += r.bouclierDebutPct ?? 0;
      t.initiativeBonus += r.initiativeBonus ?? 0;
      t.esquiveBonus += r.esquiveBonus ?? 0;
      t.soinPlat += r.soinPlat ?? 0;
    }
  }
  // relique équipée : seulement si on la possède
  const relique =
    e.reliqueEquipee && e.reliques?.includes(e.reliqueEquipee)
      ? bonusRelique(e.reliqueEquipee)
      : undefined;
  if (relique) {
    relique.degatsPct && (t.damageMult *= 1 + relique.degatsPct);
    t.resAllBonus += relique.resAll ?? 0;
    t.statsElementaires += relique.statsElementaires ?? 0;
    t.critPlat += relique.critPlat ?? 0;
    t.prospection += relique.prospectionPlat ?? 0;
    t.pvPct += relique.pvPct ?? 0;
  }
  return t;
}
export function appliquerBonusDofus(e, t) {
  for (let n of e) {
    if (t.paBonus) {
      n.paMax += t.paBonus;
      n.paActuels = n.paMax;
    }
    if (t.pvBonus) {
      n.pvBase += t.pvBonus;
      n.pvMax += t.pvBonus;
      if (n.pvActuels > 0) {
        n.pvActuels += t.pvBonus;
      }
    }
    if (t.resAllBonus) {
      ajouterResistanceTous(n, t.resAllBonus);
    }
    if (t.statsElementaires) {
      n.stats = {
        ...n.stats,
        force: n.stats.force + t.statsElementaires,
        intelligence: n.stats.intelligence + t.statsElementaires,
        agilite: n.stats.agilite + t.statsElementaires,
        chance: (n.stats.chance ?? 0) + t.statsElementaires,
      };
    }
    if (t.critPlat) {
      n.stats = {
        ...n.stats,
        crit: (n.stats.crit ?? 0) + t.critPlat,
      };
    }
    if (t.perceResistances) {
      n.perceResistances = (n.perceResistances ?? 0) + t.perceResistances;
    }
    if (t.pvPct) {
      const gain = Math.round(n.pvMax * t.pvPct);
      n.pvBase += gain;
      n.pvMax += gain;
      if (n.pvActuels > 0) {
        n.pvActuels += gain;
      }
    }
    if (t.bouclierDebutPct && n.pvActuels > 0) {
      const b = Math.round(n.pvMax * t.bouclierDebutPct);
      n.bouclier += b;
      (n.boucliersTemporaires ??= []).push({ montant: b, tours: 2 });
    }
    if (t.initiativeBonus) {
      n.initiative += t.initiativeBonus;
    }
    if (t.esquiveBonus) {
      n.esquiveBonus = (n.esquiveBonus ?? 0) + t.esquiveBonus;
    }
    if (t.soinPlat) {
      n.stats = { ...n.stats, soin: (n.stats.soin ?? 0) + t.soinPlat };
    }
    if (t.ouvreToujours) {
      n.ouvreToujours = true;
    }
  }
}
