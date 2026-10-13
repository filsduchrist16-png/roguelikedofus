import { MONDES, MONSTRES, SUCCES, ZONES } from "../data/index.js";
import { MONSTRES_RARES, RARETES, monstresDeZone } from "./config.js";
export const nouvelEtatQuetes = () => ({
  faites: [],
  compteurs: {},
});
function* quetesRestantes(etat, succes) {
  let faites = new Set(etat.faites);
  for (let succesDef of Object.values(succes)) {
    for (let quete of succesDef.quetes) {
      if (!faites.has(quete.id)) {
        yield quete;
      }
    }
  }
}
function validerQuetes(etat, succes, quetes) {
  if (!quetes.length) {
    return {
      quetes: [],
      succes: [],
    };
  }
  etat.faites.push(...quetes.map((quete) => quete.id));
  let ids = new Set(quetes.map((quete) => quete.id));
  return {
    quetes,
    succes: Object.entries(succes)
      .filter(
        ([, definition]) =>
          definition.quetes.some((quete) => ids.has(quete.id)) &&
          progressionSucces(etat, definition).complet,
      )
      .map(([id, def]) => ({
        id,
        def,
      })),
  };
}
function incrementerCompteur(etat, quete, seuil, gain) {
  if (gain <= 0) {
    return false;
  }
  return (
    (etat.compteurs[quete.id] = Math.min(seuil, (etat.compteurs[quete.id] ?? 0) + gain)),
    etat.compteurs[quete.id] >= seuil
  );
}
function critereVaincreRempli(critere, contexte) {
  return !(
    !contexte.gagne ||
    (critere.combat !== undefined && contexte.combatId !== critere.combat) ||
    (critere.boss !== undefined && !contexte.vaincus.includes(critere.boss)) ||
    (critere.noeud !== undefined && contexte.noeud !== critere.noeud) ||
    (critere.zone !== undefined && contexte.zoneId !== critere.zone) ||
    (critere.sansKO && contexte.herosKO) ||
    (critere.toursMax !== undefined && contexte.rondes > critere.toursMax) ||
    contexte.ascension < (critere.ascensionMin ?? 0) ||
    (critere.classe !== undefined && !contexte.classes.includes(critere.classe)) ||
    (critere.equipeMax !== undefined && (contexte.nbHeros ?? Infinity) > critere.equipeMax) ||
    (critere.bossPremier && contexte.ordreVaincus?.[0] !== critere.boss) ||
    (critere.bossDernier && contexte.ordreVaincus?.at(-1) !== critere.boss)
  );
}
function valeurCompteur(critere, contexte) {
  switch (critere.evenement) {
    case `monstre_vaincu`:
      if (critere.zone !== undefined && contexte.zoneId !== critere.zone) {
        return 0;
      }
      return contexte.vaincus.filter(
        (espece) => critere.espece === undefined || espece === critere.espece,
      ).length;
    case `degats_element`:
      return Math.round(contexte.degatsParElement[critere.element] ?? 0);
    case `soins`:
      return Math.round(contexte.soins);
  }
}
export function verifierQuetesCombat(etat, contexte, succes = SUCCES) {
  let rempli = [];
  for (let quete of quetesRestantes(etat, succes)) {
    let critere = quete.critere;
    if (critere.type === `vaincre` && critereVaincreRempli(critere, contexte)) {
      rempli.push(quete);
    }
    if (
      critere.type === `compteur` &&
      incrementerCompteur(etat, quete, critere.seuil, valeurCompteur(critere, contexte))
    ) {
      rempli.push(quete);
    }
  }
  return validerQuetes(etat, succes, rempli);
}
export function verifierQuetesZone(etat, contexte, succes = SUCCES) {
  let rempli = [];
  for (let quete of quetesRestantes(etat, succes)) {
    let critere = quete.critere;
    if (
      critere.type === `zone_terminee` &&
      critere.zone === contexte.zoneId &&
      contexte.ascension >= (critere.ascensionMin ?? 0)
    ) {
      rempli.push(quete);
    }
  }
  return validerQuetes(etat, succes, rempli);
}
export function verifierQuetesRun(etat, contexte, succes = SUCCES) {
  let rempli = [];
  if (contexte.victoire) {
    for (let quete of quetesRestantes(etat, succes)) {
      let critere = quete.critere;
      critere.type === `run_gagnee` &&
        ((critere.tranche !== undefined && contexte.trancheId !== critere.tranche) ||
          (critere.sansTaverne && contexte.tavernes > 0) ||
          (critere.equipeMax !== undefined && contexte.tailleEquipe > critere.equipeMax) ||
          (critere.sansRecrutement && contexte.recrutements > 0) ||
          (critere.classe !== undefined && !contexte.classes.includes(critere.classe)) ||
          contexte.ascension < (critere.ascensionMin ?? 0) ||
          (critere.quatreHerosEquipes && !contexte.quatreHerosEquipes) ||
          rempli.push(quete));
    }
  }
  return validerQuetes(etat, succes, rempli);
}
function archisDeZone(zoneId) {
  let zone = ZONES.find((candidate) => candidate.id === zoneId);
  if (zone) {
    return monstresDeZone(zone).filter((especeId) => MONSTRES[especeId]?.archiNom);
  }
  return [];
}
const zoneArchisComplete = (zoneId, captures) => {
  let archis = archisDeZone(zoneId);
  return archis.length > 0 && archis.every((especeId) => captures.has(especeId));
};
function archisDuMonde(mondeId) {
  let zones = MONDES.find((candidat) => candidat.id === mondeId)?.zones ?? [];
  return [
    ...new Set([...zones.flatMap(archisDeZone), ...(MONSTRES_RARES[mondeId]?.especes ?? [])]),
  ];
}
export function progressionArchisMonde(captures, mondeId) {
  let archis = archisDuMonde(mondeId);
  let captureSet = new Set(captures);
  return [archis.filter((especeId) => captureSet.has(especeId)).length, archis.length];
}
const mondeArchisComplet = (tranche, captures) => {
  let archis = archisDuMonde(tranche);
  return archis.length > 0 && archis.every((especeId) => captures.has(especeId));
};
export function verifierQuetesMeta(etat, meta, succes = SUCCES) {
  let archisCaptures = new Set(meta.archis);
  let rangRarete = (rarete) => {
    if (rarete === undefined) {
      return -1;
    }
    return RARETES.indexOf(rarete);
  };
  let rempli = [];
  for (let quete of quetesRestantes(etat, succes)) {
    let critere = quete.critere;
    let valide = false;
    // Songes infinis : record d'étages franchis
    if (critere.type === `songes_etage`) {
      if ((meta.songes ?? 0) >= critere.seuil) {
        rempli.push(quete);
      }
      continue;
    }
    critere.type === `archi_capture`
      ? critere.espece === undefined
        ? critere.zone === undefined
          ? critere.tranche === undefined
            ? critere.uneZoneComplete &&
              (valide = ZONES.some((zone) => zoneArchisComplete(zone.id, archisCaptures)))
            : (valide = mondeArchisComplet(critere.tranche, archisCaptures))
          : (valide = zoneArchisComplete(critere.zone, archisCaptures))
        : (valide = archisCaptures.has(critere.espece))
      : critere.type === `record_ascension`
        ? (valide = (meta.ascension[critere.tranche] ?? -1) >= critere.min)
        : critere.type === `archis_total`
          ? (valide = meta.archis.length >= critere.seuil)
          : critere.type === `objet_obtenu`
            ? (valide = rangRarete(meta.collection[critere.objet]) >= rangRarete(critere.rareteMin))
            : critere.type === `dofus_possedes`
              ? (valide = new Set(meta.dofus).size >= critere.seuil)
              : critere.type === `runs_jouees`
                ? (valide = meta.runs >= critere.seuil)
                : critere.type === `relique_obtenue`
                  ? (valide = meta.reliques.includes(critere.boss))
                  : critere.type === `dofus_possede` &&
                    (valide = meta.dofus.includes(critere.dofus));
    if (valide) {
      rempli.push(quete);
    }
  }
  return validerQuetes(etat, succes, rempli);
}
export function dofusDeSucces(succes) {
  if (`dofus` in succes.categorie) {
    return succes.categorie.dofus;
  }
}
function progressionCritere(critere, meta) {
  if (
    critere.type === `archi_capture` &&
    (critere.tranche !== undefined || critere.zone !== undefined)
  ) {
    let archis = new Set(
      critere.tranche === undefined ? archisDeZone(critere.zone) : archisDuMonde(critere.tranche),
    );
    let captures = new Set(meta.archis);
    return [[...archis].filter((especeId) => captures.has(especeId)).length, archis.size];
  }
  if (critere.type === `archis_total`) {
    return [meta.archis.length, critere.seuil];
  }
  if (critere.type === `runs_jouees`) {
    return [meta.runs, critere.seuil];
  }
  if (critere.type === `songes_etage`) {
    return [meta.songes ?? 0, critere.seuil];
  }
  if (critere.type === `dofus_possedes`) {
    return [new Set(meta.dofus).size, critere.seuil];
  }
}
export function etatQuete(etat, quete, contexte) {
  let faite = etat.faites.includes(quete.id);
  let critere = quete.critere;
  let progression =
    critere.type === `compteur`
      ? [etat.compteurs[quete.id] ?? 0, critere.seuil]
      : contexte
        ? progressionCritere(critere, contexte)
        : undefined;
  if (!progression) {
    return {
      faite,
    };
  }
  let [fait, total] = progression;
  return {
    faite,
    compteur: [faite ? total : Math.min(total, fait), total],
  };
}
export function contexteMeta(meta) {
  return {
    archis: meta.archis,
    collection: meta.collection ?? {},
    dofus: meta.dofus.map((dofus) => dofus.id),
    runs: meta.runs,
    ascension: meta.ascension ?? {},
    reliques: meta.reliques ?? [],
    // record des Songes infinis (étages franchis)
    songes: meta.records?.songes?.score ?? 0,
  };
}
export function progressionSucces(etat, succes) {
  let nbFaites = succes.quetes.filter((quete) => etat.faites.includes(quete.id)).length;
  return {
    faites: nbFaites,
    total: succes.quetes.length,
    complet: nbFaites === succes.quetes.length,
  };
}
export function trouverQuete(queteId, succes = SUCCES) {
  for (let succesDef of Object.values(succes)) {
    for (let quete of succesDef.quetes) {
      if (quete.id === queteId) {
        return quete;
      }
    }
  }
}
