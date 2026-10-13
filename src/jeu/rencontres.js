// Rencontres : la case « Rencontre » de la carte tire un événement à choix (sanctuaire des Douze,
// coffre abandonné, autel des Idoles, marchand ambulant, avis de recherche).
import { MONSTRES } from "../data/index.js";
import { ECONOMIE, monstresDeZone } from "./config.js";
import { bonusDofus } from "../sauvegarde/meta.js";
import { nomCle, secretDuMonde } from "./secret.js";
import { IDOLES_DEPART, cumulerIdoles, idolesDepartDeRun } from "./idolesDepart.js";
import { prixForge, rareteSuivante } from "./economie.js";
import { instancierObjet, pvMaxPerso } from "./run.js";

// Bénédictions des dieux du Krosmoz : elles durent toute la run.
export const BENEDICTIONS = {
  iop: { dieu: `Iop`, nom: `Fureur d'Iop`, desc: `+8 % de dégâts`, effet: { degatsPct: 0.08 } },
  sacrieur: {
    dieu: `Sacrieur`,
    nom: `Sang de Sacrieur`,
    desc: `+10 % de PV max`,
    effet: { pvPct: 0.1 },
  },
  feca: {
    dieu: `Feca`,
    nom: `Égide de Feca`,
    desc: `+6 % de résistance dans chaque élément`,
    effet: { resAll: 0.06 },
  },
  enutrof: {
    dieu: `Enutrof`,
    nom: `Flair d'Enutrof`,
    desc: `+20 % de kamas et +30 en prospection`,
    effet: { multKamas: 1.2, prospectionPlat: 30 },
  },
  ecaflip: {
    dieu: `Ecaflip`,
    nom: `Chance d'Ecaflip`,
    desc: `+6 % de coup critique`,
    effet: { critPlat: 6 },
  },
  eniripsa: {
    dieu: `Eniripsa`,
    nom: `Mot d'Eniripsa`,
    desc: `+25 en Soin pour chaque héros`,
    effet: { soinPlat: 25 },
  },
  xelor: {
    dieu: `Xélor`,
    nom: `Sablier de Xélor`,
    desc: `+3 d'initiative`,
    effet: { initiativeBonus: 3 },
  },
  sram: {
    dieu: `Sram`,
    nom: `Ombre de Sram`,
    desc: `+5 % d'esquive`,
    effet: { esquiveBonus: 0.05 },
  },
};

// Idoles : les monstres de la zone sont plus forts, les récompenses plus grosses (jusqu'à la fin de la zone).
export const IDOLES = {
  nahuatl: {
    nom: `Idole Nahuatl`,
    malus: `Monstres +20 % de PV`,
    bonus: `+35 % d'XP`,
    pvMult: 1.2,
    xpMult: 1.35,
  },
  ultram: {
    nom: `Idole Ultram`,
    malus: `Monstres +15 % de dégâts`,
    bonus: `+40 % de kamas et +40 en prospection`,
    degatsMult: 1.15,
    kamasMult: 1.4,
    prospection: 40,
  },
  dynamo: {
    nom: `Idole Dynamo`,
    malus: `Monstres +15 % de PV et +10 % de dégâts`,
    bonus: `+30 % d'XP et de kamas, +30 en prospection`,
    pvMult: 1.15,
    degatsMult: 1.1,
    xpMult: 1.3,
    kamasMult: 1.3,
    prospection: 30,
  },
};

const CROCHETEURS = new Set([`sram`, `roublard`, `ecaflip`]);
const POIDS = {
  sanctuaire: 25,
  coffre: 25,
  marchand: 20,
  idoles: 15,
  traque: 15,
  cle: 12,
  forgemage: 10,
  temple: 10,
};
// Part des PV max rendue à un héros relevé au temple.
export const PV_TEMPLE = 0.5;

/** Tire un type de rencontre ; `exclus` retire des types (par ex. la clé quand on en a déjà une). */
export function tirerRencontre(rng, exclus = []) {
  const poids = Object.entries(POIDS).filter(([id]) => !exclus.includes(id));
  const total = poids.reduce((somme, [, poidsType]) => somme + poidsType, 0);
  let tirage = rng() * total;
  for (const [id, poidsType] of poids) {
    tirage -= poidsType;
    if (tirage < 0) {
      return id;
    }
  }
  return `coffre`;
}

/** Types à écarter du tirage selon la run : clé inutile, temple sans K.O. (ou mort définitive),
 * forgemage sans objet à monter. */
export function rencontresExclues(run, { mortDefinitive = false } = {}) {
  const exclus = [];
  if (run.cle || !secretDuMonde(run.trancheId)) {
    exclus.push(`cle`);
  }
  if (mortDefinitive || !herosKO(run).length) {
    exclus.push(`temple`);
  }
  if (!objetsForgeables(run).length) {
    exclus.push(`forgemage`);
  }
  return exclus;
}

/** Héros à 0 PV. */
export const herosKO = (run) => run.persos.filter((perso) => perso.pvActuels <= 0);

/** Prix du temple pour relever un héros. */
export const prixTemple = (toile) => Math.round(gainBase(toile) * 2);

/** Relève un héros K.O. avec une part de ses PV max (sans effet sur un héros debout). */
export function releverHeros(perso, part = PV_TEMPLE) {
  if (perso.pvActuels > 0) {
    return false;
  }
  perso.pvActuels = Math.max(1, Math.round(pvMaxPerso(perso) * part));
  return true;
}

/** Objets que le forgemage peut monter (portés ou en sac), les plus chers à forger d'abord. */
export function objetsForgeables(run, max = 4) {
  const tous = [
    ...run.persos.flatMap((perso) => Object.values(perso.equipement ?? {}).filter(Boolean)),
    ...run.inventaire,
  ].filter((objet) => rareteSuivante(objet));
  return tous.sort((premier, second) => prixForge(second) - prixForge(premier)).slice(0, max);
}

/** Forge sans frais ni risque : l'objet passe au palier de rareté supérieur. */
export function forgerGratuit(inst) {
  const suivante = rareteSuivante(inst);
  if (!suivante) {
    return false;
  }
  const neuf = instancierObjet(inst.id, suivante);
  inst.rarete = neuf.rarete;
  inst.stats = neuf.stats;
  inst.adaptatif = neuf.adaptatif;
  inst.resistances = neuf.resistances;
  inst.pa = neuf.pa;
  return true;
}

export const gainBase = (toile) =>
  Math.round(ECONOMIE.gain.combat_dur * (1 + ECONOMIE.gainParToile * (toile - 1)));

// Trois dieux au hasard, parmi ceux dont la bénédiction n'est pas déjà active.
export function dieuxProposes(run, rng) {
  const libres = Object.keys(BENEDICTIONS).filter((id) => !(run.benedictions ?? []).includes(id));
  const out = [];
  while (out.length < 3 && libres.length) {
    out.push(libres.splice(Math.floor(rng() * libres.length), 1)[0]);
  }
  return out;
}

export function idolesProposees(rng) {
  const ids = Object.keys(IDOLES);
  ids.splice(Math.floor(rng() * ids.length), 1);
  return ids;
}

export const peutCrocheter = (run) => run.persos.some((perso) => CROCHETEURS.has(perso.classeId));

export function prixMarchand(toile) {
  const gain = gainBase(toile);
  return {
    potion: gain,
    parchemin: Math.round(gain * 1.5),
    philtre: Math.round(gain * 1.2),
    cle: Math.round(gain * 2),
  };
}

export const zoneAArchis = (zone) => monstresDeZone(zone).some((id) => MONSTRES[id]?.archiNom);

// Idole de l'autel de la zone (rencontre), sans les idoles de départ.
export function idoleZone(run, zoneId) {
  // sans zone (Songes infinis) : aucune idole d'autel
  return run.idole && run.idole.zone === zoneId ? IDOLES[run.idole.id] : null;
}

// Effets des idoles en cours : celle de la zone et celles choisies au départ, cumulées. Sans idole
// de départ, c'est exactement l'idole de la zone (ou null).
export function idoleActive(run, zoneId) {
  const zone = idoleZone(run, zoneId);
  const depart = idolesDepartDeRun(run).map((id) => IDOLES_DEPART[id]);
  if (!depart.length) {
    return zone;
  }
  return cumulerIdoles(zone ? [zone, ...depart] : depart);
}

export function traqueActive(run, zoneId) {
  return run.traque?.zone === zoneId ? run.traque : null;
}

// Bonus de l'équipe : Dofus possédés + bénédictions de la run.
export function bonusEquipeRun(meta, run) {
  const bonus = bonusDofus(meta);
  for (const id of run?.benedictions ?? []) {
    const effet = BENEDICTIONS[id]?.effet ?? {};
    bonus.damageMult *= 1 + (effet.degatsPct ?? 0);
    bonus.pvPct += effet.pvPct ?? 0;
    bonus.resAllBonus += effet.resAll ?? 0;
    bonus.multKamas *= effet.multKamas ?? 1;
    bonus.prospection += effet.prospectionPlat ?? 0;
    bonus.critPlat += effet.critPlat ?? 0;
    bonus.soinPlat += effet.soinPlat ?? 0;
    bonus.initiativeBonus += effet.initiativeBonus ?? 0;
    bonus.esquiveBonus += effet.esquiveBonus ?? 0;
  }
  return bonus;
}

// Effets en cours (affichés sur la carte).
export function effetsEnCours(run, zoneId) {
  const out = (run.benedictions ?? []).map((id) => ({
    icone: `✨`,
    nom: BENEDICTIONS[id].nom,
    desc: `Bénédiction de ${BENEDICTIONS[id].dieu} pour toute la run : ${BENEDICTIONS[id].desc}.`,
  }));
  for (const id of idolesDepartDeRun(run)) {
    out.push({
      icone: `🗿`,
      nom: IDOLES_DEPART[id].nom,
      desc: `Pour toute la run : ${IDOLES_DEPART[id].malus} ; ${IDOLES_DEPART[id].bonus}.`,
    });
  }
  const idole = idoleZone(run, zoneId);
  if (idole) {
    out.push({
      icone: `🗿`,
      nom: idole.nom,
      desc: `Jusqu'à la fin de la zone : ${idole.malus} ; ${idole.bonus}.`,
    });
  }
  if (run.cle && secretDuMonde(run.trancheId)) {
    out.push({
      icone: `🗝️`,
      nom: nomCle(run.trancheId),
      desc: `Après le boss d'une zone, tu pourras ouvrir le donjon secret : ${secretDuMonde(run.trancheId).nom}. Plus la zone est avancée, plus il est dur… et plus il rapporte.`,
    });
  }
  const traque = traqueActive(run, zoneId);
  if (traque) {
    out.push({
      icone: `📜`,
      nom: traque.archi ? `Traque` : `Prime`,
      desc: traque.archi
        ? `Le prochain combat contient un archimonstre (monstres +20 % de PV).`
        : `Le prochain combat rapporte le double de kamas (monstres +20 % de PV).`,
    });
  }
  return out;
}
