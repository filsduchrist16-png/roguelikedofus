import { signalerEchecSauvegarde } from "./echec.js";
import { signalerChangement } from "./nuage.js";
import {
  CLASSES,
  CONFIG_RELIQUES,
  DOFUS,
  MONDES,
  RELIQUES,
  RELIQUES_RUN,
  SUCCES,
} from "../data/index.js";
import { DIFFICULTES, RARETES, bonusRelique, getMonde } from "../jeu/config.js";
import { dofusDeSucces, nouvelEtatQuetes, progressionSucces } from "../jeu/quetes.js";
import { ajouterResistanceTous, effetsDifficulte, prospectionEquipe } from "../jeu/run.js";
import { idolesDepartValides } from "../jeu/idolesDepart.js";
import { normaliserAlmanax } from "../jeu/almanax.js";
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
        // Almanax du jour (1.8.0) : absent = aucun progrès, aucune récompense en attente
        almanax: normaliserAlmanax(donnees.almanax),
        // historique des 20 dernières runs et statistiques du compte (1.9.0) : absents = vides
        historique: normaliserHistorique(donnees.historique),
        compte: normaliserCompte(donnees.compte),
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
  noterTempsJeu(meta);
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

// ---------- Historique des runs et statistiques du compte (1.9.0) ----------
export const MAX_HISTORIQUE = 20;
// Au-delà, un écart entre deux sauvegardes compte comme une pause (onglet oublié ouvert).
export const PAUSE_TEMPS_JEU = 5 * 60 * 1000;
const ISSUES_RUN = [`victoire`, `defaite`, `abandon`];
const MODES_RUN = [`run`, `jour`, `songes`];
const entier = (valeur, max = 1e9) =>
  typeof valeur === `number` && Number.isFinite(valeur)
    ? Math.max(0, Math.min(max, Math.floor(valeur)))
    : 0;
const texteCourt = (valeur, max) => (typeof valeur === `string` ? valeur.slice(0, max) : ``);
const compteVierge = () => ({ tempsJeu: 0, combats: 0, heros: {}, meilleurs: {} });
/** Une run de l'historique lue dans une sauvegarde : nettoyée, ou null si elle est illisible. */
function normaliserEntreeHistorique(brut) {
  if (!brut || typeof brut !== `object` || !Number.isFinite(brut.date) || brut.date <= 0) {
    return null;
  }
  return {
    date: Math.floor(brut.date),
    mode: MODES_RUN.includes(brut.mode) ? brut.mode : `run`,
    monde: MONDES.some((monde) => monde.id === brut.monde) ? brut.monde : `t1`,
    difficulte: entier(brut.difficulte, DIFFICULTES.length - 1),
    issue: ISSUES_RUN.includes(brut.issue) ? brut.issue : `defaite`,
    zone: entier(brut.zone, 99),
    nbZones: entier(brut.nbZones, 99),
    etage: entier(brut.etage, 9999),
    equipe: (Array.isArray(brut.equipe) ? brut.equipe : [])
      .filter((heros) => CLASSES[heros?.classe])
      .slice(0, 4)
      .map((heros) => ({ classe: heros.classe, niveau: entier(heros.niveau, 999) })),
    cause: texteCourt(brut.cause, 140),
    reliques: (Array.isArray(brut.reliques) ? brut.reliques : [])
      .filter((id) => RELIQUES_RUN[id])
      .slice(0, 40),
    reliquesBoss: (Array.isArray(brut.reliquesBoss) ? brut.reliquesBoss : [])
      .filter((id) => RELIQUES[id])
      .slice(0, 10),
    combats: entier(brut.combats, 9999),
  };
}
export function normaliserHistorique(liste) {
  return Array.isArray(liste)
    ? liste.map(normaliserEntreeHistorique).filter(Boolean).slice(0, MAX_HISTORIQUE)
    : [];
}
export function normaliserCompte(brut) {
  const compte = compteVierge();
  if (!brut || typeof brut !== `object` || Array.isArray(brut)) {
    return compte;
  }
  compte.tempsJeu = entier(brut.tempsJeu);
  compte.combats = entier(brut.combats);
  for (const [classe, runs] of Object.entries(brut.heros ?? {})) {
    if (CLASSES[classe] && entier(runs) > 0) {
      compte.heros[classe] = entier(runs);
    }
  }
  for (const [monde, parDifficulte] of Object.entries(brut.meilleurs ?? {})) {
    if (!MONDES.some((candidat) => candidat.id === monde) || !parDifficulte) {
      continue;
    }
    for (const [cran, record] of Object.entries(parDifficulte)) {
      if (DIFFICULTES[cran] && record && typeof record === `object`) {
        (compte.meilleurs[monde] ??= {})[cran] = {
          zone: entier(record.zone, 99),
          victoires: entier(record.victoires),
        };
      }
    }
  }
  return compte;
}
// Temps de jeu approximatif : l'écart depuis la sauvegarde précédente (plafonné), à chaque
// sauvegarde de la méta.
let dernierPointage = Date.now();
export function noterTempsJeu(meta, maintenant = Date.now()) {
  const ecart = maintenant - dernierPointage;
  dernierPointage = maintenant;
  if (!meta || !(ecart > 0)) {
    return;
  }
  const compte = (meta.compte ??= compteVierge());
  compte.tempsJeu = entier(compte.tempsJeu) + Math.round(Math.min(ecart, PAUSE_TEMPS_JEU) / 1000);
}
/**
 * Ligne d'historique d'une run qui se termine. issue : victoire, defaite ou abandon ; zone : zone
 * atteinte (1 = première) ; cause : ce qui a battu l'équipe.
 */
export function entreeHistorique(run, { issue, zone, nbZones, cause = ``, date = Date.now() }) {
  return normaliserEntreeHistorique({
    date,
    mode: run.mode === `songes` ? `songes` : run.jour ? `jour` : `run`,
    monde: run.trancheId ?? `t1`,
    difficulte: run.ascension ?? 0,
    issue,
    zone,
    nbZones,
    etage: run.mode === `songes` ? (run.etage ?? 0) : 0,
    equipe: (run.persos ?? []).map((perso) => ({
      classe: perso.classeId,
      niveau: perso.progression?.niveau ?? 1,
    })),
    cause,
    reliques: run.reliquesRun ?? [],
    reliquesBoss: run.stats?.reliques ?? [],
    combats: run.stats?.combats ?? 0,
  });
}
/** Range la run dans l'historique (20 dernières) et met à jour les statistiques du compte. */
export function noterFinDeRun(meta, run, infos) {
  const entree = entreeHistorique(run, infos);
  if (!entree) {
    return null;
  }
  meta.historique = [entree, ...normaliserHistorique(meta.historique)].slice(0, MAX_HISTORIQUE);
  const compte = (meta.compte = normaliserCompte(meta.compte));
  compte.combats += entree.combats;
  for (const { classe } of entree.equipe) {
    compte.heros[classe] = (compte.heros[classe] ?? 0) + 1;
  }
  if (entree.mode !== `songes`) {
    const record = ((compte.meilleurs[entree.monde] ??= {})[entree.difficulte] ??= {
      zone: 0,
      victoires: 0,
    });
    record.zone = Math.max(record.zone, entree.zone);
    record.victoires += entree.issue === `victoire` ? 1 : 0;
  }
  sauverMeta(meta);
  return entree;
}
/**
 * Statistiques du compte pour l'écran Historique : temps de jeu, runs, combats, héros le plus joué,
 * et pour chaque monde et chaque difficulté la meilleure zone atteinte (gagnée ou non).
 */
export function statistiquesCompte(meta) {
  const compte = normaliserCompte(meta.compte);
  const favori = Object.entries(compte.heros).sort(
    (premier, second) => second[1] - premier[1] || premier[0].localeCompare(second[0]),
  )[0];
  return {
    tempsJeu: compte.tempsJeu,
    runs: entier(meta.runs),
    victoires: entier(meta.victoires),
    combats: compte.combats,
    herosFavori: favori ? { classe: favori[0], runs: favori[1] } : null,
    records: MONDES.filter((monde) => monde.zones.length).map((monde) => {
      const gagneJusquA = meta.ascension?.[monde.id];
      return {
        monde: monde.id,
        nbZones: monde.zones.length,
        toileMax: entier(meta.statsMonde?.[monde.id]?.toileMax),
        score: entier(meta.records?.[monde.id]?.score),
        parDifficulte: DIFFICULTES.map((_difficulte, cran) => {
          const record = compte.meilleurs[monde.id]?.[cran];
          // une difficulté ne s'ouvre qu'après une victoire à la précédente : toutes celles
          // jusqu'au meilleur palier gagné l'ont été (même avant la 1.9.0)
          const gagnee =
            (record?.victoires ?? 0) > 0 || (Number.isFinite(gagneJusquA) && cran <= gagneJusquA);
          return {
            difficulte: cran,
            zone: gagnee ? monde.zones.length : (record?.zone ?? 0),
            gagnee,
            victoires: record?.victoires ?? 0,
          };
        }),
      };
    }),
  };
}
/** « ≈ 3 h 20 », « ≈ 12 min », « moins d'une minute ». */
export function texteDuree(secondes) {
  const minutes = Math.floor(entier(secondes) / 60);
  if (minutes < 1) {
    return `moins d'une minute`;
  }
  if (minutes < 60) {
    return `≈ ${minutes} min`;
  }
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return `≈ ${heures} h${reste ? ` ${String(reste).padStart(2, `0`)}` : ``}`;
}
