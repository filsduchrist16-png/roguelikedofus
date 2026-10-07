import { MONDES, MONSTRES, SUCCES, ZONES } from "../data/index.js";
import { MONSTRES_RARES, RARETES, monstresDeZone } from "./config.js";
export const nouvelEtatQuetes = () => ({
  faites: [],
  compteurs: {},
});
function* quetesRestantes(e, t) {
  let n = new Set(e.faites);
  for (let e of Object.values(t)) {
    for (let t of e.quetes) {
      if (!n.has(t.id)) {
        yield t;
      }
    }
  }
}
function validerQuetes(e, t, quetes) {
  if (!quetes.length) {
    return {
      quetes: [],
      succes: [],
    };
  }
  e.faites.push(...quetes.map((e) => e.id));
  let r = new Set(quetes.map((e) => e.id));
  return {
    quetes,
    succes: Object.entries(t)
      .filter(([, t]) => t.quetes.some((e) => r.has(e.id)) && progressionSucces(e, t).complet)
      .map(([id, def]) => ({
        id,
        def,
      })),
  };
}
function incrementerCompteur(e, t, seuil, r) {
  if (r <= 0) {
    return false;
  }
  return (
    (e.compteurs[t.id] = Math.min(seuil, (e.compteurs[t.id] ?? 0) + r)),
    e.compteurs[t.id] >= seuil
  );
}
function critereVaincreRempli(e, t) {
  return !(
    !t.gagne ||
    (e.combat !== undefined && t.combatId !== e.combat) ||
    (e.boss !== undefined && !t.vaincus.includes(e.boss)) ||
    (e.noeud !== undefined && t.noeud !== e.noeud) ||
    (e.zone !== undefined && t.zoneId !== e.zone) ||
    (e.sansKO && t.herosKO) ||
    (e.toursMax !== undefined && t.rondes > e.toursMax) ||
    t.ascension < (e.ascensionMin ?? 0) ||
    (e.classe !== undefined && !t.classes.includes(e.classe)) ||
    (e.equipeMax !== undefined && (t.nbHeros ?? Infinity) > e.equipeMax) ||
    (e.bossPremier && t.ordreVaincus?.[0] !== e.boss) ||
    (e.bossDernier && t.ordreVaincus?.at(-1) !== e.boss)
  );
}
function valeurCompteur(e, t) {
  switch (e.evenement) {
    case `monstre_vaincu`:
      if (e.zone !== undefined && t.zoneId !== e.zone) {
        return 0;
      }
      return t.vaincus.filter((t) => e.espece === undefined || t === e.espece).length;
    case `degats_element`:
      return Math.round(t.degatsParElement[e.element] ?? 0);
    case `soins`:
      return Math.round(t.soins);
  }
}
export function verifierQuetesCombat(e, t, n = SUCCES) {
  let r = [];
  for (let i of quetesRestantes(e, n)) {
    let n = i.critere;
    if (n.type === `vaincre` && critereVaincreRempli(n, t)) {
      r.push(i);
    }
    if (n.type === `compteur` && incrementerCompteur(e, i, n.seuil, valeurCompteur(n, t))) {
      r.push(i);
    }
  }
  return validerQuetes(e, n, r);
}
export function verifierQuetesZone(e, t, n = SUCCES) {
  let r = [];
  for (let i of quetesRestantes(e, n)) {
    let e = i.critere;
    if (e.type === `zone_terminee` && e.zone === t.zoneId && t.ascension >= (e.ascensionMin ?? 0)) {
      r.push(i);
    }
  }
  return validerQuetes(e, n, r);
}
export function verifierQuetesRun(e, t, n = SUCCES) {
  let r = [];
  if (t.victoire) {
    for (let i of quetesRestantes(e, n)) {
      let e = i.critere;
      e.type === `run_gagnee` &&
        ((e.tranche !== undefined && t.trancheId !== e.tranche) ||
          (e.sansTaverne && t.tavernes > 0) ||
          (e.equipeMax !== undefined && t.tailleEquipe > e.equipeMax) ||
          (e.sansRecrutement && t.recrutements > 0) ||
          (e.classe !== undefined && !t.classes.includes(e.classe)) ||
          t.ascension < (e.ascensionMin ?? 0) ||
          (e.quatreHerosEquipes && !t.quatreHerosEquipes) ||
          r.push(i));
    }
  }
  return validerQuetes(e, n, r);
}
function archisDeZone(e) {
  let t = ZONES.find((t) => t.id === e);
  if (t) {
    return monstresDeZone(t).filter((e) => MONSTRES[e]?.archiNom);
  }
  return [];
}
const zoneArchisComplete = (e, t) => {
  let n = archisDeZone(e);
  return n.length > 0 && n.every((e) => t.has(e));
};
function archisDuMonde(e) {
  let t = MONDES.find((t) => t.id === e)?.zones ?? [];
  return [...new Set([...t.flatMap(archisDeZone), ...(MONSTRES_RARES[e]?.especes ?? [])])];
}
export function progressionArchisMonde(e, t) {
  let n = archisDuMonde(t);
  let r = new Set(e);
  return [n.filter((e) => r.has(e)).length, n.length];
}
const mondeArchisComplet = (tranche, t) => {
  let n = archisDuMonde(tranche);
  return n.length > 0 && n.every((e) => t.has(e));
};
export function verifierQuetesMeta(e, t, n = SUCCES) {
  let r = new Set(t.archis);
  let i = (e) => {
    if (e === undefined) {
      return -1;
    }
    return RARETES.indexOf(e);
  };
  let a = [];
  for (let o of quetesRestantes(e, n)) {
    let e = o.critere;
    let n = false;
    e.type === `archi_capture`
      ? e.espece === undefined
        ? e.zone === undefined
          ? e.tranche === undefined
            ? e.uneZoneComplete && (n = ZONES.some((e) => zoneArchisComplete(e.id, r)))
            : (n = mondeArchisComplet(e.tranche, r))
          : (n = zoneArchisComplete(e.zone, r))
        : (n = r.has(e.espece))
      : e.type === `record_ascension`
        ? (n = (t.ascension[e.tranche] ?? -1) >= e.min)
        : e.type === `archis_total`
          ? (n = t.archis.length >= e.seuil)
          : e.type === `objet_obtenu`
            ? (n = i(t.collection[e.objet]) >= i(e.rareteMin))
            : e.type === `dofus_possedes`
              ? (n = new Set(t.dofus).size >= e.seuil)
              : e.type === `runs_jouees`
                ? (n = t.runs >= e.seuil)
                : e.type === `relique_obtenue` && (n = t.reliques.includes(e.boss));
    if (n) {
      a.push(o);
    }
  }
  return validerQuetes(e, n, a);
}
export function dofusDeSucces(e) {
  if (`dofus` in e.categorie) {
    return e.categorie.dofus;
  }
}
function progressionCritere(e, t) {
  if (e.type === `archi_capture` && (e.tranche !== undefined || e.zone !== undefined)) {
    let n = new Set(e.tranche === undefined ? archisDeZone(e.zone) : archisDuMonde(e.tranche));
    let r = new Set(t.archis);
    return [[...n].filter((e) => r.has(e)).length, n.size];
  }
  if (e.type === `archis_total`) {
    return [t.archis.length, e.seuil];
  }
  if (e.type === `runs_jouees`) {
    return [t.runs, e.seuil];
  }
  if (e.type === `dofus_possedes`) {
    return [new Set(t.dofus).size, e.seuil];
  }
}
export function etatQuete(e, t, n) {
  let faite = e.faites.includes(t.id);
  let t_critere = t.critere;
  let a =
    t_critere.type === `compteur`
      ? [e.compteurs[t.id] ?? 0, t_critere.seuil]
      : n
        ? progressionCritere(t_critere, n)
        : undefined;
  if (!a) {
    return {
      faite,
    };
  }
  let [o, s] = a;
  return {
    faite,
    compteur: [faite ? s : Math.min(s, o), s],
  };
}
export function contexteMeta(e) {
  return {
    archis: e.archis,
    collection: e.collection ?? {},
    dofus: e.dofus.map((e) => e.id),
    runs: e.runs,
    ascension: e.ascension ?? {},
    reliques: e.reliques ?? [],
  };
}
export function progressionSucces(e, t) {
  let length = t.quetes.filter((t) => e.faites.includes(t.id)).length;
  return {
    faites: length,
    total: t.quetes.length,
    complet: length === t.quetes.length,
  };
}
export function trouverQuete(e, t = SUCCES) {
  for (let n of Object.values(t)) {
    for (let t of n.quetes) {
      if (t.id === e) {
        return t;
      }
    }
  }
}
