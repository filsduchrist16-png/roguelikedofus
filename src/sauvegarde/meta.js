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
      let donnees = JSON.parse(brut);
      if (!donnees || typeof donnees !== `object` || Array.isArray(donnees)) {
        throw new Error(`méta illisible`);
      }
      let ascensionBrute =
        donnees.ascension ??
        ((donnees.victoires ?? 0) > 0
          ? {
              t1: 0,
            }
          : undefined);
      let ancienneVersion = (donnees.version ?? 0) < 2;
      let ascension =
        ascensionBrute &&
        (ancienneVersion
          ? Object.fromEntries(Object.keys(ascensionBrute).map((monde) => [monde, 0]))
          : ascensionBrute);
      // champ par champ : une valeur abîmée ne fait pas perdre les autres
      let dofus = (Array.isArray(donnees.dofus) ? donnees.dofus : [])
        .map((entree) => (typeof entree === `string` ? { id: entree } : entree))
        .filter((entree) => entree && typeof entree === `object` && DOFUS[entree.id]);
      let quetes = {
        faites: Array.isArray(donnees.quetes?.faites)
          ? donnees.quetes.faites.filter((cle) => typeof cle === `string`)
          : [],
        compteurs: {
          ...(donnees.quetes?.compteurs && typeof donnees.quetes.compteurs === `object`
            ? donnees.quetes.compteurs
            : {}),
        },
      };
      if ((donnees.version ?? 0) < 4) {
        for (let succesId of donnees.succes ?? []) {
          let queteId = MIGRATION_SUCCES[succesId];
          if (queteId && !quetes.faites.includes(queteId)) {
            quetes.faites.push(queteId);
          }
        }
      }
      return {
        version: 4,
        dofus,
        archis: Array.isArray(donnees.archis)
          ? donnees.archis.filter((archi) => typeof archi === `string`)
          : [],
        runs: Number.isFinite(donnees.runs) ? donnees.runs : 0,
        victoires: Number.isFinite(donnees.victoires) ? donnees.victoires : 0,
        quetes,
        // raretés connues seulement (elles finissent dans des classes CSS)
        collection: Object.fromEntries(
          Object.entries(donnees.collection ?? {}).filter(([, rarete]) => RARETES.includes(rarete)),
        ),
        ascension,
        statsMonde: normaliserStatsMonde(donnees.statsMonde),
        reliques: normaliserReliques(donnees.reliques),
        dofusSuspendus: Array.isArray(donnees.dofusSuspendus) ? donnees.dofusSuspendus : [],
        secrets: Array.isArray(donnees.secrets) ? donnees.secrets : [],
        jaugeArchi: Number.isFinite(donnees.jaugeArchi) ? Math.max(0, donnees.jaugeArchi) : 0,
        records: normaliserRecords(donnees.records),
        // relique équipée (E2) : absente = aucune
        reliqueEquipee:
          typeof donnees.reliqueEquipee === `string` && RELIQUES[donnees.reliqueEquipee]
            ? donnees.reliqueEquipee
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
export function sauverMeta(meta) {
  let ecrit = true;
  try {
    localStorage.setItem(CLE_META, JSON.stringify(meta));
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
const succesDuDofusId = (id) =>
  Object.values(SUCCES).find((succes) => dofusDeSucces(succes) === id);
// Dofus dont le succès est terminé mais pas encore remis (ancienne sauvegarde, ou cascade).
export function dofusEnAttente(meta) {
  const possedes = new Set(meta.dofus.map((dofus) => dofus.id));
  return Object.values(DOFUS)
    .filter((dofus) => !possedes.has(dofus.id))
    .filter((dofus) => {
      const succes = succesDuDofusId(dofus.id);
      return succes && meta.quetes && progressionSucces(meta.quetes, succes).complet;
    })
    .map((dofus) => dofus.id);
}
export function dofusDebloquables(meta) {
  return dofusEnAttente(meta).sort(
    (premier, second) => DOFUS[premier].niveau - DOFUS[second].niveau,
  );
}
// Anciennes versions : des Dofus avaient été mis de côté pour respecter un ordre strict. Ils
// reviennent tous, avec leur jet.
export function rendreDofusSuspendus(meta) {
  const suspendus = (meta.dofusSuspendus ?? []).filter(
    (dofus) => DOFUS[dofus.id] && !meta.dofus.some((existant) => existant.id === dofus.id),
  );
  if (meta.dofusSuspendus?.length) {
    meta.dofus.push(...suspendus);
    meta.dofusSuspendus = [];
    sauverMeta(meta);
  }
  return suspendus.map((dofus) => dofus.id);
}
export function ajouterDofus(meta, dofusId, rng = Math.random) {
  // un Dofus mis de côté retrouve son jet
  let ancien = (meta.dofusSuspendus ?? []).find((candidat) => candidat.id === dofusId);
  if (ancien) {
    meta.dofusSuspendus = meta.dofusSuspendus.filter((candidat) => candidat !== ancien);
    meta.dofus.push(ancien);
    sauverMeta(meta);
    return;
  }
  let jetPlage = DOFUS[dofusId]?.prospectionJet;
  let jet = jetPlage
    ? jetPlage[0] + Math.floor(rng() * (jetPlage[1] - jetPlage[0] + 1))
    : undefined;
  meta.dofus.push(
    jet === undefined
      ? {
          id: dofusId,
        }
      : {
          id: dofusId,
          jet,
        },
  );
  sauverMeta(meta);
}
export function dofusAGagner(meta, succes) {
  let dofusId = dofusDeSucces(succes);
  if (dofusId && !meta.dofus.some((dofus) => dofus.id === dofusId)) {
    return dofusId;
  }
}
/**
 * Efface les Dofus ET les quêtes des succès de Dofus : sinon ils reviendraient aussitôt (leur succès
 * resterait terminé) et le Kaliptus pourrait être retiré à volonté.
 */
export function reinitialiserDofus(meta) {
  meta.dofus = [];
  meta.dofusSuspendus = [];
  const ids = new Set(
    Object.values(SUCCES)
      .filter((succes) => succes.categorie?.dofus)
      .flatMap((succes) => succes.quetes.map((quete) => quete.id)),
  );
  meta.quetes.faites = meta.quetes.faites.filter((id) => !ids.has(id));
  for (const id of ids) {
    delete meta.quetes.compteurs[id];
  }
  sauverMeta(meta);
}
export function enregistrerRun(meta, victoire, mondeId) {
  meta.runs += 1;
  if (victoire) {
    meta.victoires += 1;
    if (mondeId) {
      statsMondeModifiable(meta, mondeId).victoires += 1;
    }
  }
  sauverMeta(meta);
}
export function statsMonde(meta, mondeId) {
  let stats = meta.statsMonde?.[mondeId];
  return {
    toileMax: stats?.toileMax ?? 0,
    victoires: stats?.victoires ?? 0,
  };
}
function statsMondeModifiable(meta, mondeId) {
  meta.statsMonde ??= {};
  return (meta.statsMonde[mondeId] ??= {
    toileMax: 0,
    victoires: 0,
  });
}
export function enregistrerToileMax(meta, mondeId, toile) {
  let stats = statsMondeModifiable(meta, mondeId);
  stats.toileMax = Math.max(stats.toileMax, toile);
}
// Score record par monde (runs avec ou sans idoles de départ) : { score, idoles, ascension }.
function normaliserRecords(records) {
  const out = {};
  if (!records || typeof records !== `object` || Array.isArray(records)) {
    return out;
  }
  for (const [monde, record] of Object.entries(records)) {
    if (record && typeof record === `object` && Number.isFinite(record.score) && record.score > 0) {
      out[monde] = {
        score: Math.floor(record.score),
        idoles: idolesDepartValides(record.idoles),
        ascension: Number.isFinite(record.ascension)
          ? Math.max(0, Math.floor(record.ascension))
          : 0,
      };
    }
  }
  return out;
}
export function recordMonde(meta, cle) {
  return meta.records?.[cle];
}
/** Garde le score s'il bat le record du monde. Renvoie true si c'est un nouveau record. */
export function enregistrerRecord(meta, cle, score, idoles = [], ascension = 0) {
  if (!(score > (meta.records?.[cle]?.score ?? 0))) {
    return false;
  }
  meta.records = {
    ...(meta.records ?? {}),
    [cle]: { score, idoles: idolesDepartValides(idoles), ascension },
  };
  sauverMeta(meta);
  return true;
}
export function chanceRelique(cran, prospection) {
  return (
    (CONFIG_RELIQUES.base + CONFIG_RELIQUES.parCran * cran) *
    (1 + Math.max(0, prospection - 100) / CONFIG_RELIQUES.diviseurProspection)
  );
}
export function prospectionMoyenne(run, bonus = 0) {
  if (run.persos.length) {
    return (prospectionEquipe(run) + bonus) / run.persos.length;
  }
  return 0;
}
export function tirerReliques(meta, bossIds, ascension, prospection, rng) {
  let chance = chanceRelique(ascension, prospection);
  let obtenues = [];
  for (let bossId of bossIds) {
    !RELIQUES[bossId] ||
      meta.reliques?.includes(bossId) ||
      obtenues.includes(bossId) ||
      (rng() < chance && obtenues.push(bossId));
  }
  if (obtenues.length) {
    meta.reliques = [...(meta.reliques ?? []), ...obtenues];
  }
  return obtenues;
}
function normaliserReliques(reliques) {
  if (Array.isArray(reliques)) {
    return [...new Set(reliques.filter((id) => typeof id === `string` && !!RELIQUES[id]))];
  }
  return [];
}
function normaliserStatsMonde(stats) {
  let resultat = {};
  if (!stats || typeof stats !== `object`) {
    return resultat;
  }
  let entierPositif = (valeur) => {
    if (typeof valeur === `number` && Number.isFinite(valeur) && valeur > 0) {
      return Math.floor(valeur);
    }
    return 0;
  };
  for (let [mondeId, brut] of Object.entries(stats)) {
    let entree = brut && typeof brut === `object` ? brut : {};
    resultat[mondeId] = {
      toileMax: entierPositif(entree.toileMax),
      victoires: entierPositif(entree.victoires),
    };
  }
  return resultat;
}
export function pctSoinTaverne(cran) {
  return effetsDifficulte(cran).tavernePct ?? 0.5;
}
export function ascensionMonde(meta, mondeId) {
  return meta.ascension?.[mondeId];
}
export function enregistrerAscension(meta, mondeId, ascension) {
  meta.ascension = {
    ...(meta.ascension ?? {}),
    [mondeId]: Math.max(meta.ascension?.[mondeId] ?? 0, ascension),
  };
  sauverMeta(meta);
}
if (DIFFICULTES.findIndex((palier) => palier.id === `cauchemar`) < 0) {
  throw Error(`PALIER_CAUCHEMAR : aucun palier "cauchemar" dans ASCENSION — table incohérente.`);
}
export function mondePrecedentTermine(meta, mondeId) {
  let indice = MONDES.findIndex((monde) => monde.id === mondeId);
  if (indice <= 0) {
    return indice === 0;
  }
  return ascensionMonde(meta, MONDES[indice - 1].id) !== undefined;
}
export function mondeJouable(meta, mondeId) {
  let monde = getMonde(mondeId);
  return mondePrecedentTermine(meta, mondeId) && monde.zones.length > 0 && !monde.enChantier;
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
export function dofusPossedes(meta) {
  return new Set(meta.dofus.map((dofus) => dofus.id));
}
function meilleurJetDofus(meta, dofusId) {
  let jets = meta.dofus
    .filter((dofus) => dofus.id === dofusId && dofus.jet !== undefined)
    .map((dofus) => dofus.jet);
  if (jets.length) {
    return Math.max(...jets);
  }
}
const RARETES_ORDRE = [...RARETES];
export function enregistrerCollection(meta, objets) {
  if (!objets.length) {
    return;
  }
  let collection = (meta.collection ??= {});
  let modifie = false;
  for (let objet of objets) {
    let rarete = objet.rarete;
    if (!rarete) {
      continue;
    }
    let connue = collection[objet.id];
    if (!connue || RARETES_ORDRE.indexOf(rarete) > RARETES_ORDRE.indexOf(connue)) {
      collection[objet.id] = rarete;
      modifie = true;
    }
  }
  if (modifie) {
    sauverMeta(meta);
  }
}
export function capturerArchi(meta, monstreId) {
  if (meta.archis.includes(monstreId)) {
    return false;
  }
  return (meta.archis.push(monstreId), sauverMeta(meta), true);
}
export function bonusDofus(meta) {
  let bonus = {
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
  for (let dofusId of dofusPossedes(meta)) {
    let def = DOFUS[dofusId];
    def &&
      (def.degatsPct && (bonus.damageMult *= 1 + def.degatsPct),
      def.paBonus && (bonus.paBonus += def.paBonus),
      def.pvBonus && (bonus.pvBonus += def.pvBonus),
      def.resAll && (bonus.resAllBonus += def.resAll),
      def.statsElementaires && (bonus.statsElementaires += def.statsElementaires),
      def.critPlat && (bonus.critPlat += def.critPlat),
      def.perceResistances && (bonus.perceResistances += def.perceResistances),
      def.prospectionJet && (bonus.prospection += meilleurJetDofus(meta, dofusId) ?? 0),
      dofusId === `dofus_du_cauchemar` && (bonus.ouvreToujours = true));
    if (def) {
      bonus.pvPct += def.pvPct ?? 0;
      bonus.multKamas *= def.multKamas ?? 1;
      bonus.prospection += def.prospectionPlat ?? 0;
      bonus.bouclierDebutPct += def.bouclierDebutPct ?? 0;
      bonus.initiativeBonus += def.initiativeBonus ?? 0;
      bonus.esquiveBonus += def.esquiveBonus ?? 0;
      bonus.soinPlat += def.soinPlat ?? 0;
    }
  }
  // relique équipée : seulement si on la possède
  const relique =
    meta.reliqueEquipee && meta.reliques?.includes(meta.reliqueEquipee)
      ? bonusRelique(meta.reliqueEquipee)
      : undefined;
  if (relique) {
    relique.degatsPct && (bonus.damageMult *= 1 + relique.degatsPct);
    bonus.resAllBonus += relique.resAll ?? 0;
    bonus.statsElementaires += relique.statsElementaires ?? 0;
    bonus.critPlat += relique.critPlat ?? 0;
    bonus.prospection += relique.prospectionPlat ?? 0;
    bonus.pvPct += relique.pvPct ?? 0;
  }
  return bonus;
}
export function appliquerBonusDofus(combattants, bonus) {
  for (let combattant of combattants) {
    if (bonus.paBonus) {
      combattant.paMax += bonus.paBonus;
      combattant.paActuels = combattant.paMax;
    }
    if (bonus.pvBonus) {
      combattant.pvBase += bonus.pvBonus;
      combattant.pvMax += bonus.pvBonus;
      if (combattant.pvActuels > 0) {
        combattant.pvActuels += bonus.pvBonus;
      }
    }
    if (bonus.resAllBonus) {
      ajouterResistanceTous(combattant, bonus.resAllBonus);
    }
    if (bonus.statsElementaires) {
      combattant.stats = {
        ...combattant.stats,
        force: combattant.stats.force + bonus.statsElementaires,
        intelligence: combattant.stats.intelligence + bonus.statsElementaires,
        agilite: combattant.stats.agilite + bonus.statsElementaires,
        chance: (combattant.stats.chance ?? 0) + bonus.statsElementaires,
      };
    }
    if (bonus.critPlat) {
      combattant.stats = {
        ...combattant.stats,
        crit: (combattant.stats.crit ?? 0) + bonus.critPlat,
      };
    }
    if (bonus.perceResistances) {
      combattant.perceResistances = (combattant.perceResistances ?? 0) + bonus.perceResistances;
    }
    if (bonus.pvPct) {
      const gain = Math.round(combattant.pvMax * bonus.pvPct);
      combattant.pvBase += gain;
      combattant.pvMax += gain;
      if (combattant.pvActuels > 0) {
        // bonus négatif (autel de sang) : les PV actuels sont plafonnés, un héros debout le reste
        combattant.pvActuels =
          gain >= 0
            ? combattant.pvActuels + gain
            : Math.max(1, Math.min(combattant.pvActuels, combattant.pvMax));
      }
    }
    if (bonus.bouclierDebutPct && combattant.pvActuels > 0) {
      const montant = Math.round(combattant.pvMax * bonus.bouclierDebutPct);
      combattant.bouclier += montant;
      (combattant.boucliersTemporaires ??= []).push({ montant, tours: 2 });
    }
    if (bonus.initiativeBonus) {
      combattant.initiative += bonus.initiativeBonus;
    }
    if (bonus.esquiveBonus) {
      combattant.esquiveBonus = (combattant.esquiveBonus ?? 0) + bonus.esquiveBonus;
    }
    if (bonus.soinPlat) {
      combattant.stats = {
        ...combattant.stats,
        soin: (combattant.stats.soin ?? 0) + bonus.soinPlat,
      };
    }
    if (bonus.ouvreToujours) {
      combattant.ouvreToujours = true;
    }
  }
}
