// Rencontres : la case « Rencontre » de la carte tire un événement à choix (sanctuaire des Douze,
// coffre abandonné, autel des Idoles, marchand ambulant, avis de recherche).
import { MONSTRES } from "../data/index.js";
import { ECONOMIE, monstresDeZone } from "./config.js";
import { bonusDofus } from "../sauvegarde/meta.js";

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
const POIDS = { sanctuaire: 25, coffre: 25, marchand: 20, idoles: 15, traque: 15 };

export function tirerRencontre(rng) {
  const total = Object.values(POIDS).reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (const [id, p] of Object.entries(POIDS)) {
    x -= p;
    if (x < 0) {
      return id;
    }
  }
  return `coffre`;
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

export const peutCrocheter = (run) => run.persos.some((p) => CROCHETEURS.has(p.classeId));

export function prixMarchand(toile) {
  const g = gainBase(toile);
  return { potion: g, parchemin: Math.round(g * 1.5), philtre: Math.round(g * 1.2) };
}

export const zoneAArchis = (zone) => monstresDeZone(zone).some((id) => MONSTRES[id]?.archiNom);

export function idoleActive(run, zoneId) {
  return run.idole?.zone === zoneId ? IDOLES[run.idole.id] : null;
}

export function traqueActive(run, zoneId) {
  return run.traque?.zone === zoneId ? run.traque : null;
}

// Bonus de l'équipe : Dofus possédés + bénédictions de la run.
export function bonusEquipeRun(meta, run) {
  const t = bonusDofus(meta);
  for (const id of run?.benedictions ?? []) {
    const r = BENEDICTIONS[id]?.effet ?? {};
    t.damageMult *= 1 + (r.degatsPct ?? 0);
    t.pvPct += r.pvPct ?? 0;
    t.resAllBonus += r.resAll ?? 0;
    t.multKamas *= r.multKamas ?? 1;
    t.prospection += r.prospectionPlat ?? 0;
    t.critPlat += r.critPlat ?? 0;
    t.soinPlat += r.soinPlat ?? 0;
    t.initiativeBonus += r.initiativeBonus ?? 0;
    t.esquiveBonus += r.esquiveBonus ?? 0;
  }
  return t;
}

// Effets en cours (affichés sur la carte).
export function effetsEnCours(run, zoneId) {
  const out = (run.benedictions ?? []).map((id) => ({
    icone: `✨`,
    nom: BENEDICTIONS[id].nom,
    desc: `Bénédiction de ${BENEDICTIONS[id].dieu} pour toute la run : ${BENEDICTIONS[id].desc}.`,
  }));
  const idole = idoleActive(run, zoneId);
  if (idole) {
    out.push({
      icone: `🗿`,
      nom: idole.nom,
      desc: `Jusqu'à la fin de la zone : ${idole.malus} ; ${idole.bonus}.`,
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
