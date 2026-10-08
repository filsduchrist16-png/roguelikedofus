import {
  BUTIN_ZONES,
  CLASSES,
  COMBATS,
  MONDES,
  MONSTRES,
  RELIQUES,
  SECRETS,
  ZONES,
} from "../data/index.js";
export function zonesDuMonde(e) {
  return e.zones.map((e) => ZONES.find((t) => t.id === e));
}
// Le donjon secret d'un monde, présenté comme une zone (pour le bestiaire et l'armurerie).
export function zoneSecrete(mondeId) {
  const s = SECRETS[mondeId];
  return s
    ? {
        id: `secret:${mondeId}`,
        nom: `🗝️ ${s.nom}`,
        secret: true,
        pools: { normales: [], elite: [], boss: [s.combat] },
      }
    : null;
}
export function getMonde(e, t = MONDES) {
  return t.find((t) => t.id === e) ?? t[0];
}
export function trouverZoneDansMonde(e, t = MONDES) {
  for (let tranche of t) {
    let index = tranche.zones.indexOf(e);
    if (index >= 0) {
      return {
        tranche,
        index,
      };
    }
  }
  return null;
}
export function indexDebutMonde(e, t = MONDES) {
  let n = 0;
  for (let r of t) {
    if (r.id === e) {
      return n;
    }
    n += r.zones.length;
  }
  return 0;
}
export const XP_PAR_COMBAT = {
  combat: 110,
  combat_dur: 195,
};
const XP_BONUS_PAR_TOILE = 0.3;
export function calculerXpCombat(e, t, n) {
  let r = 1 + XP_BONUS_PAR_TOILE * (t - 1);
  return Math.round(e * r * (getMonde(n).xpMult ?? 1));
}
// Après chaque combat gagné, les héros encore debout récupèrent une part de leurs PV max.
export const RECUPERATION = {
  victoire: 0.1,
};
export const CONFIG_CARTE = {
  lignesMin: 10,
  lignesMax: 12,
  poids: {
    combat: 60,
    combat_dur: 12,
    taverne: 12,
    otomai: 8,
    zaap: 8,
    hdv: 8,
    forgemagie: 6,
    rencontre: 10,
  },
};
export const RARETES = [`commun`, `rare`, `epique`, `legendaire`];
export const RARETES_INFO = {
  commun: {
    nom: `Commun`,
    poids: 60,
  },
  rare: {
    nom: `Rare`,
    poids: 25,
  },
  epique: {
    nom: `Épique`,
    poids: 12,
  },
  legendaire: {
    nom: `Légendaire`,
    poids: 3,
  },
};
export function butinDeZone(e) {
  let t = trouverZoneDansMonde(e);
  if (t) {
    return BUTIN_ZONES[indexDebutMonde(t.tranche.id) + t.index + 1] ?? null;
  }
  return null;
}
export function listerButin(e) {
  if (e) {
    return [...e.normales, ...e.elites, ...e.boss];
  }
  return [];
}
export const ECONOMIE = {
  gain: {
    combat: 15,
    combat_dur: 30,
    donjon: 60,
  },
  gainParToile: 0.3,
  prix: {
    commun: 40,
    rare: 90,
    epique: 200,
    legendaire: 450,
  },
  prixParToile: 0.3,
  tauxRevente: 0.5,
  tailleStock: 5,
  forgeCoef: 0.6,
  forgeTemeraire: {
    coef: 0.3,
    pEchec: 0.3,
  },
};
export const TAUX_BUTIN = {
  taux: {
    combat: 0.2,
    combat_dur: 0.32,
    donjon: 0.5,
  },
  coefProspection: 0.001,
  capProspection: 0.75,
};
export const AFFIXES_GROUPE = [
  {
    id: `enrage`,
    nom: `Enragés`,
    desc: `+20 % aux caractéristiques offensives`,
    statMult: 1.2,
  },
  {
    id: `cuirasse`,
    nom: `Cuirassés`,
    desc: `+20 % de PV et +5 % de résistances`,
    pvMult: 1.2,
    resAll: 0.05,
  },
  {
    id: `veloce`,
    nom: `Véloces`,
    desc: `+4 d'initiative et +1 PA`,
    initBonus: 4,
    paBonus: 1,
  },
];
export const CONFIG_ARCHI = {
  chance: 0.008,
  philtre: 0.004,
  philtresMax: 4,
  pvMult: 2,
  statMult: 1.5,
};
export const MONSTRES_RARES = {
  t1: {
    especes: [`piou_rouge`, `piou_vert`, `piou_bleu`, `piou_jaune`, `piou_rose`, `piou_violet`],
    chance: 0.005,
  },
};
export const DIFFICULTES = [
  {
    id: `normal`,
    nom: `Normal`,
    desc: `Le jeu de base.`,
    effets: {},
  },
  {
    id: `difficile`,
    nom: `Difficile`,
    desc: `Les monstres tapent 10 % plus fort et ont 20 % de PV en plus. Un monstre de plus en première ligne.`,
    effets: {
      degatsMult: 1.1,
      pvMult: 1.2,
      renfortAvant: true,
    },
  },
  {
    id: `extreme`,
    nom: `Extrême`,
    desc: `Monstres à +15 % de dégâts et +30 % de PV, un de plus en première ligne. Les tavernes ne rendent plus que 30 % des PV.`,
    effets: {
      degatsMult: 1.15,
      pvMult: 1.3,
      renfortAvant: true,
      tavernePct: 0.3,
    },
  },
  {
    id: `cauchemar`,
    nom: `Cauchemar`,
    desc: `Monstres à +30 % de dégâts et +50 % de PV, un de plus en première ligne, tavernes à 30 %. Un héros qui tombe est perdu pour la run.`,
    effets: {
      degatsMult: 1.3,
      pvMult: 1.5,
      renfortAvant: true,
      tavernePct: 0.3,
      mortDefinitive: true,
    },
  },
  {
    id: `ultime`,
    nom: `Ultime`,
    desc: `Comme Cauchemar, mais plus aucune taverne dès que ton équipe est au complet.`,
    effets: {
      degatsMult: 1.3,
      pvMult: 1.5,
      renfortAvant: true,
      tavernePct: 0.3,
      mortDefinitive: true,
      tavernesCoupeesAPlein: true,
    },
  },
];
export const DIFFICULTE_MAX = DIFFICULTES.length - 1;
export const DOSSIER_ICONE_SORT = (() => {
  let e = {};
  for (let t of Object.values(CLASSES)) {
    for (let n of t.sorts) {
      e[n] = t.id;
    }
  }
  for (let t of Object.values(MONSTRES)) {
    for (let n of t.sorts) {
      if (!(n in e)) {
        e[n] = `monstres`;
      }
    }
  }
  return e;
})();
export function monstresDeZone(e) {
  let t = [...e.pools.normales, ...e.pools.elite, ...e.pools.boss];
  let n = new Set();
  for (let e of t) {
    for (let t of COMBATS[e]?.ennemis ?? []) {
      n.add(t.monstre);
    }
  }
  return [...n];
}
export function bossDeZone(e) {
  let t = [];
  for (let n of e.pools.boss) {
    for (let e of COMBATS[n]?.ennemis ?? []) {
      if (MONSTRES[e.monstre]?.boss && !t.includes(e.monstre)) {
        t.push(e.monstre);
      }
    }
  }
  return t;
}
export function reliquesDuMonde(e) {
  let t = MONDES.find((t) => t.id === e);
  let n = [];
  for (let e of t ? zonesDuMonde(t) : []) {
    for (let t of bossDeZone(e)) {
      if (RELIQUES[t] && !n.includes(t)) {
        n.push(t);
      }
    }
  }
  return n;
}
