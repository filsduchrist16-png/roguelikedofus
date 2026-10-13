// Songes infinis (mode de fin de jeu, inspiré des Songes de Dofus) : une suite infinie de combats
// de plus en plus durs. Logique pure : génération des étages, facteur de puissance, affixes de
// songe, récompenses entre deux étages, score et déblocage. Le hasard est injecté (`rng`).
import { COMBATS, EQUIPEMENTS, MONDES, MONSTRES, SUCCES, ZONES } from "../data/index.js";
import {
  AFFIXES_GROUPE,
  ECONOMIE,
  RARETES,
  RARETES_INFO,
  butinDeZone,
  listerButin,
} from "./config.js";
import { BENEDICTIONS, forgerGratuit, objetsForgeables } from "./rencontres.js";
import {
  appliquerAffixe,
  appliquerPuissance,
  instancierObjet,
  nouvelleRun,
  pvMaxPerso,
} from "./run.js";
import { ajouterKamas } from "./economie.js";
import { EMPLACEMENTS, typeDeEmplacement } from "./emplacements.js";
import { ascensionMonde, statsMonde } from "../sauvegarde/meta.js";

export const MODE_SONGES = `songes`;
// Monde des héros (niveau maximal) et du butin.
export const MONDE_SONGES = `t5`;
export const CONFIG_SONGES = {
  // combats normaux et élites tirés dans ces mondes
  mondesCombats: [`t4`, `t5`],
  // puissance des monstres à l'étage n : base × croissance^(n − 1) (réglé par simulation)
  facteurBase: 0.8,
  croissance: 1.06,
  // boss (de tous les mondes, ramenés à la menace d'un boss du Monde 5) tous les `bossTous` étages
  bossTous: 5,
  facteurBoss: 1,
  // combats normaux rapprochés de la menace médiane (0 : bruts, 0,5 : tous égaux) ; le reste de
  // l'écart fait la variance d'un étage à l'autre
  normalisation: 0.35,
  // un affixe de songe permanent de plus après chaque multiple de `affixeTous`
  affixeTous: 3,
  // palier (taverne ou HDV, soin complet) après chaque boss
  palierTous: 5,
  // soin de la récompense « Repos » : part des PV max, et des PV des K.O. relevés
  soinPct: 0.5,
  releve: 0.3,
  // kamas de départ par quête de succès des Songes terminée
  kamasParQuete: 150,
  // étage maximal accepté dans une sauvegarde
  etageMax: 100000,
};

// ---------- Déblocage ----------
/** Les Songes s'ouvrent après une run du Monde 5 gagnée (ou un palier de difficulté gagné). */
export function songesDebloques(meta) {
  return (
    statsMonde(meta, MONDE_SONGES).victoires > 0 || ascensionMonde(meta, MONDE_SONGES) !== undefined
  );
}
export const CONDITION_SONGES = `🔒 Gagne une run du Monde 5 pour ouvrir les Songes infinis.`;

// ---------- Combats ----------
// Menace brute d'un combat : PV totaux × somme des multiplicateurs de dégâts (1 + 0,03 × stat).
// Un facteur f de puissance multiplie les deux : la menace est multipliée par f².
export function menaceCombat(combatId) {
  let pv = 0;
  let degats = 0;
  for (const ennemi of COMBATS[combatId]?.ennemis ?? []) {
    const def = MONSTRES[ennemi.monstre];
    if (!def) {
      continue;
    }
    pv += def.pv;
    const stat = Math.max(
      ...[`force`, `intelligence`, `agilite`, `chance`].map((cle) => def.stats?.[cle] ?? 0),
    );
    degats += 1 + 0.03 * stat;
  }
  return pv * degats;
}
const mediane = (valeurs) => {
  const tri = [...valeurs].sort((premier, second) => premier - second);
  return tri.length ? tri[Math.floor(tri.length / 2)] : 1;
};
const zonesDe = (mondeIds) =>
  MONDES.filter((monde) => mondeIds.includes(monde.id)).flatMap((monde) => monde.zones);
let cacheCombats = null;
/** Combats possibles : normaux et élites des Mondes 4-5, boss de tous les mondes. */
export function combatsSonges() {
  if (cacheCombats) {
    return cacheCombats;
  }
  const pools = (ids) => ZONES.filter((zone) => ids.includes(zone.id)).map((zone) => zone.pools);
  const normaux = [
    ...new Set(
      pools(zonesDe(CONFIG_SONGES.mondesCombats)).flatMap((pool) => [
        ...pool.normales,
        ...pool.elite,
      ]),
    ),
  ].filter((id) => COMBATS[id]);
  const boss = [
    ...new Set(pools(zonesDe(MONDES.map((monde) => monde.id))).flatMap((pool) => pool.boss)),
  ].filter((id) => COMBATS[id]);
  const referenceBoss = mediane(
    pools(zonesDe([MONDE_SONGES]))
      .flatMap((pool) => pool.boss)
      .map(menaceCombat),
  );
  const referenceNormaux = mediane(normaux.map(menaceCombat));
  cacheCombats = { normaux, boss, referenceBoss, referenceNormaux };
  return cacheCombats;
}

/** Puissance des monstres à l'étage n (avant la mise à l'échelle des boss). */
export function facteurSonge(etage) {
  return CONFIG_SONGES.facteurBase * CONFIG_SONGES.croissance ** (Math.max(1, etage) - 1);
}
export const estEtageBoss = (etage) => etage > 0 && etage % CONFIG_SONGES.bossTous === 0;
export const estPalier = (etage) => etage > 0 && etage % CONFIG_SONGES.palierTous === 0;
/** Un affixe de songe s'ajoute après chaque étage multiple de `affixeTous`. */
export const gagneAffixe = (etage) => etage > 0 && etage % CONFIG_SONGES.affixeTous === 0;

/**
 * Étage n : { etage, combatId, boss, type, facteur }. Un boss (étage multiple de 5) est ramené à la
 * menace d'un boss du Monde 5, un combat normal rapproché de la menace médiane, puis le facteur de
 * l'étage s'applique.
 */
export function genererEtage(etage, rng) {
  const { normaux, boss, referenceBoss, referenceNormaux } = combatsSonges();
  const estBoss = estEtageBoss(etage);
  const liste = estBoss ? boss : normaux;
  const combatId = liste[Math.floor(rng() * liste.length)];
  let facteur = facteurSonge(etage);
  if (estBoss) {
    facteur *= CONFIG_SONGES.facteurBoss * Math.sqrt(referenceBoss / menaceCombat(combatId));
  } else {
    facteur *= (referenceNormaux / menaceCombat(combatId)) ** CONFIG_SONGES.normalisation;
  }
  return {
    etage,
    combatId,
    boss: estBoss,
    type: estBoss ? `donjon` : `combat`,
    facteur: Math.round(facteur * 1000) / 1000,
  };
}

// ---------- Affixes de songe ----------
export const affixeConnu = (id) => AFFIXES_GROUPE.some((affixe) => affixe.id === id);
/** Nouvel affixe : d'abord ceux qui manquent, puis ils se cumulent (une 2e couche, etc.). */
export function tirerAffixeSonge(actifs, rng) {
  const compte = (id) => actifs.filter((actif) => actif === id).length;
  const minimum = Math.min(...AFFIXES_GROUPE.map((affixe) => compte(affixe.id)));
  const candidats = AFFIXES_GROUPE.filter((affixe) => compte(affixe.id) === minimum);
  return candidats[Math.floor(rng() * candidats.length)].id;
}
/** Affixes actifs regroupés pour l'affichage : [{ id, nom, desc, n }]. */
export function affixesAffiches(actifs = []) {
  const groupes = [];
  for (const id of actifs) {
    const affixe = AFFIXES_GROUPE.find((candidat) => candidat.id === id);
    if (!affixe) {
      continue;
    }
    const existant = groupes.find((groupe) => groupe.id === id);
    if (existant) {
      existant.n += 1;
    } else {
      groupes.push({ id, nom: affixe.nom, desc: affixe.desc, n: 1 });
    }
  }
  return groupes.map((groupe) => ({
    ...groupe,
    nom: groupe.n > 1 ? `${groupe.nom} ×${groupe.n}` : groupe.nom,
  }));
}

// ---------- Butin du Monde 5 ----------
let cacheButin = null;
/** Objets du butin du Monde 5 (normaux, élites et boss, sans doublon). */
export function butinSonges() {
  cacheButin ??= [
    ...new Set(
      MONDES.find((monde) => monde.id === MONDE_SONGES).zones.flatMap((zoneId) =>
        listerButin(butinDeZone(zoneId)),
      ),
    ),
  ].filter((id) => EQUIPEMENTS[id]?.tiers);
  return cacheButin;
}
/** Raretés possibles d'un objet de récompense : elles montent d'un cran tous les 5 étages. */
export function raretesSonge(etage) {
  const palier = Math.max(0, Math.floor((etage - 1) / CONFIG_SONGES.palierTous));
  const min = Math.min(2, palier);
  return RARETES.slice(min, Math.min(RARETES.length, min + 2));
}
function tirerParPoids(raretes, rng) {
  const total = raretes.reduce((somme, rarete) => somme + RARETES_INFO[rarete].poids, 0);
  let tirage = rng() * total;
  for (const rarete of raretes) {
    tirage -= RARETES_INFO[rarete].poids;
    if (tirage < 0) {
      return rarete;
    }
  }
  return raretes[0];
}
/** Un objet du Monde 5 (d'un type donné, facultatif) dans une des raretés proposées. */
export function tirerObjetSonge(rng, raretes, type) {
  const ids = butinSonges().filter((id) => !type || EQUIPEMENTS[id].slot === type);
  for (let essai = 0; essai < 20 && ids.length; essai++) {
    const id = ids[Math.floor(rng() * ids.length)];
    const possibles = raretes.filter((rarete) => EQUIPEMENTS[id].tiers[rarete]);
    if (possibles.length) {
      return instancierObjet(id, tirerParPoids(possibles, rng));
    }
  }
  return null;
}
/** Kit de départ : un objet commun du Monde 5 par emplacement (les deux anneaux compris). */
export function kitDepart(rng) {
  const kit = {};
  for (const emplacement of EMPLACEMENTS) {
    const objet = tirerObjetSonge(rng, [`commun`], typeDeEmplacement(emplacement));
    if (objet) {
      kit[emplacement] = objet;
    }
  }
  return kit;
}
/** Habille un héros avec un kit de départ (sans toucher aux objets déjà portés). */
export function equiperKit(perso, rng) {
  const kit = kitDepart(rng);
  for (const [emplacement, objet] of Object.entries(kit)) {
    perso.equipement[emplacement] ??= objet;
  }
}

// ---------- Récompenses entre deux étages ----------
export const montantKamasSonge = (etage) =>
  Math.round(ECONOMIE.gain.donjon * (1 + ECONOMIE.gainParToile * 59) * (0.8 + 0.04 * etage));
/** Amélioration : une bénédiction pas encore active, sinon un forgemage gratuit d'un objet. */
export function ameliorationPossible(run, rng) {
  const libres = Object.keys(BENEDICTIONS).filter((id) => !(run.benedictions ?? []).includes(id));
  if (libres.length) {
    return { benediction: libres[Math.floor(rng() * libres.length)] };
  }
  return objetsForgeables(run, 1).length ? { forge: true } : null;
}
/**
 * Trois récompenses différentes après l'étage `etage` (franchi), parmi : objet, soin (sauf au
 * palier), kamas, amélioration. Chaque récompense est entièrement tirée ici (objet compris) pour qu'une reprise de
 * sauvegarde ne permette pas de relancer le tirage.
 */
export function tirerRecompenses(etage, run, rng) {
  // un palier soigne déjà complètement : pas de repos proposé
  const types = estPalier(etage) ? [`objet`, `kamas`] : [`objet`, `soin`, `kamas`];
  const amelioration = ameliorationPossible(run, rng);
  if (amelioration) {
    types.push(`amelioration`);
  }
  const choisis = [];
  while (choisis.length < 3 && types.length) {
    choisis.push(types.splice(Math.floor(rng() * types.length), 1)[0]);
  }
  return choisis.map((type) => {
    switch (type) {
      case `objet`:
        return { type, objet: tirerObjetSonge(rng, raretesSonge(etage)) };
      case `soin`:
        return { type, pct: CONFIG_SONGES.soinPct, releve: CONFIG_SONGES.releve };
      case `kamas`:
        return { type, montant: montantKamasSonge(etage) };
      default:
        return { type, ...amelioration };
    }
  });
}

/** Monstres d'un étage : puissance de l'étage, puis chaque affixe de songe actif. */
export function appliquerSonge(monstres, facteur, affixes, rng) {
  appliquerPuissance(monstres, facteur);
  for (const id of affixes ?? []) {
    appliquerAffixe(monstres, rng, id);
  }
}
/** Repos : les héros debout récupèrent `pct` de leurs PV max, les K.O. se relèvent à `releve`. */
export function soignerSonge(run, pct = CONFIG_SONGES.soinPct, releve = CONFIG_SONGES.releve) {
  let total = 0;
  for (const perso of run.persos) {
    const max = pvMaxPerso(perso);
    const avant = Math.max(0, perso.pvActuels);
    perso.pvActuels =
      perso.pvActuels <= 0
        ? Math.max(1, Math.round(max * releve))
        : Math.min(max, perso.pvActuels + Math.round(max * pct));
    total += perso.pvActuels - avant;
  }
  return total;
}
/** Applique la récompense choisie ; renvoie un texte court pour le bandeau. */
export function appliquerRecompense(run, recompense) {
  switch (recompense?.type) {
    case `objet`:
      if (recompense.objet) {
        run.inventaire.push(recompense.objet);
        return `🎒 ${EQUIPEMENTS[recompense.objet.id]?.nom ?? `Objet`} ajouté au sac`;
      }
      return ``;
    case `soin`:
      return `💤 Repos : +${soignerSonge(run, recompense.pct, recompense.releve)} PV pour l'équipe`;
    case `kamas`:
      ajouterKamas(run, recompense.montant);
      return `💰 +${recompense.montant} kamas`;
    case `amelioration`:
      if (recompense.benediction && BENEDICTIONS[recompense.benediction]) {
        if (!(run.benedictions ?? []).includes(recompense.benediction)) {
          (run.benedictions ??= []).push(recompense.benediction);
        }
        const benediction = BENEDICTIONS[recompense.benediction];
        return `✨ ${benediction.nom} : ${benediction.desc} jusqu'à la fin du songe`;
      }
      if (recompense.forge) {
        const [objet] = objetsForgeables(run, 1);
        if (objet && forgerGratuit(objet)) {
          return `🔨 ${EQUIPEMENTS[objet.id]?.nom ?? `Objet`} monte d'un cran de rareté`;
        }
      }
      return ``;
    default:
      return ``;
  }
}

// ---------- Run de songes ----------
/** Nouvelle tentative : héros au niveau maximal du Monde 5, kit commun, difficulté Normal. */
export function nouvelleRunSonges(classes, rng, kamas = 0) {
  const run = nouvelleRun(classes, 0, MONDE_SONGES, []);
  for (const perso of run.persos) {
    equiperKit(perso, rng);
    perso.pvActuels = pvMaxPerso(perso);
  }
  run.kamas = kamas;
  run.mode = MODE_SONGES;
  run.etage = 1;
  run.affixesSonge = [];
  // récompenses proposées et palier en attente (gardés pour une reprise de sauvegarde)
  run.offreSonge = null;
  run.palierSonge = null;
  return run;
}
/**
 * Étage franchi : affixe éventuel, récompenses proposées, palier (soin complet) après un boss, puis
 * l'étage suivant. Renvoie { affixe, palier } pour les messages.
 */
export function franchirEtage(run, rng) {
  const etage = run.etage;
  let affixe = null;
  if (gagneAffixe(etage)) {
    affixe = tirerAffixeSonge(run.affixesSonge, rng);
    run.affixesSonge.push(affixe);
  }
  run.offreSonge = tirerRecompenses(etage, run, rng);
  const palier = estPalier(etage);
  if (palier) {
    for (const perso of run.persos) {
      perso.pvActuels = pvMaxPerso(perso);
    }
    run.palierSonge = { taverne: false, hdv: false };
  }
  run.etage = etage + 1;
  return { affixe, palier };
}

// ---------- Score, record, succès ----------
/** Score d'une tentative : le dernier étage franchi. */
export const scoreSonges = (etageAtteint) => Math.max(0, Math.floor(etageAtteint) - 1);
export const recordSonges = (meta) => meta.records?.[MODE_SONGES]?.score ?? 0;
const quetesSonges = () =>
  Object.values(SUCCES)
    .filter((succes) => succes.categorie?.songes)
    .flatMap((succes) => succes.quetes);
/** Kamas de départ : une petite somme par quête de succès des Songes déjà faite. */
export function kamasDepartSonges(meta) {
  const faites = new Set(meta.quetes?.faites ?? []);
  return (
    quetesSonges().filter((quete) => faites.has(quete.id)).length * CONFIG_SONGES.kamasParQuete
  );
}

// ---------- Sauvegarde ----------
/** Une run de songes lue dans une sauvegarde est-elle cohérente ? */
export function runSongesValide(run) {
  return (
    run?.mode === MODE_SONGES &&
    Number.isInteger(run.etage) &&
    run.etage >= 1 &&
    run.etage <= CONFIG_SONGES.etageMax &&
    Array.isArray(run.affixesSonge) &&
    run.affixesSonge.length <= Math.ceil(CONFIG_SONGES.etageMax / CONFIG_SONGES.affixeTous) &&
    run.affixesSonge.every(affixeConnu)
  );
}
