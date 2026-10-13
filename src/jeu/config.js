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
export function zonesDuMonde(monde) {
  return monde.zones.map((zoneId) => ZONES.find((zone) => zone.id === zoneId));
}
// Le donjon secret d'un monde, présenté comme une zone (pour le bestiaire et l'armurerie).
export function zoneSecrete(mondeId) {
  const secret = SECRETS[mondeId];
  return secret
    ? {
        id: `secret:${mondeId}`,
        nom: `🗝️ ${secret.nom}`,
        secret: true,
        pools: { normales: [], elite: [], boss: [secret.combat] },
      }
    : null;
}
export function getMonde(id, mondes = MONDES) {
  return mondes.find((monde) => monde.id === id) ?? mondes[0];
}
export function trouverZoneDansMonde(zoneId, mondes = MONDES) {
  for (let tranche of mondes) {
    let index = tranche.zones.indexOf(zoneId);
    if (index >= 0) {
      return {
        tranche,
        index,
      };
    }
  }
  return null;
}
export function indexDebutMonde(mondeId, mondes = MONDES) {
  let compteur = 0;
  for (let monde of mondes) {
    if (monde.id === mondeId) {
      return compteur;
    }
    compteur += monde.zones.length;
  }
  return 0;
}
export const XP_PAR_COMBAT = {
  combat: 110,
  combat_dur: 195,
  // le donjon donne autant d'XP qu'un combat dur
  donjon: 195,
};
const XP_BONUS_PAR_TOILE = 0.3;
export function calculerXpCombat(xpBase, numZone, mondeId) {
  let facteur = 1 + XP_BONUS_PAR_TOILE * (numZone - 1);
  return Math.round(xpBase * facteur * (getMonde(mondeId).xpMult ?? 1));
}
// Après chaque combat gagné, les héros encore debout récupèrent une part de leurs PV max.
export const RECUPERATION = {
  victoire: 0.1,
};
// Facteur de puissance (PV et dégâts des monstres) par type de combat, en plus de celui de la zone
// (src/data/ajustementsZones.json) : [première zone, dernière zone] d'un monde, interpolé
// linéairement. Les premières zones restent douces (équipe incomplète, peu d'objets) ; le
// facteur « donjon » s'ajoute à ajustementsDonjons.json (corrections par donjon). Réglé par
// simulation (npm run sim).
export const PUISSANCE_PAR_TYPE = {
  combat: [1.03, 1.2],
  combat_dur: [1.03, 1.35],
  donjon: [0.9, 0.9],
};
// Facteur du type de combat pour la zone d'indice `index` (0 à `nb` - 1) de son monde.
export function facteurType(type, index = 0, nb = 12) {
  const plage = PUISSANCE_PAR_TYPE[type];
  if (!plage) return 1;
  return (
    plage[0] + (plage[1] - plage[0]) * (nb > 1 ? Math.min(1, Math.max(0, index / (nb - 1))) : 0)
  );
}
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
export function butinDeZone(zoneId) {
  let trouve = trouverZoneDansMonde(zoneId);
  if (trouve) {
    return BUTIN_ZONES[indexDebutMonde(trouve.tranche.id) + trouve.index + 1] ?? null;
  }
  return null;
}
export function listerButin(butin) {
  if (butin) {
    return [...butin.normales, ...butin.elites, ...butin.boss];
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
  tailleStock: 7,
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
  // tirages par victoire : 6 depuis le passage à 8 emplacements (4 avant)
  tiragesMax: 6,
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
// Furie des boss : sous `seuil` de ses PV, au début de son tour, un boss gagne des dégâts et des PA
// (une fois par combat). Les difficultés peuvent avancer le seuil et ajouter un bouclier.
export const FURIE_BOSS = {
  seuil: 0.5,
  degatsPct: 0.2,
  pa: 1,
};
export const CONFIG_ARCHI = {
  chance: 0.008,
  philtre: 0.004,
  philtresMax: 4,
  // un archimonstre jamais capturé apparaît 5 fois plus souvent…
  multNouveau: 5,
  // … et chaque combat sans nouvel archi remplit la « jauge de traque » (gardée d'une run à
  // l'autre, vidée quand un archi inédit apparaît)
  bonusParCombatSansNouveau: 0.02,
  bonusSansNouveauMax: 0.4,
  pvMult: 2,
  statMult: 1.5,
};
export const MONSTRES_RARES = {
  t1: {
    especes: [`piou_rouge`, `piou_vert`, `piou_bleu`, `piou_jaune`, `piou_rose`, `piou_violet`],
    // 2 % : avec 0,5 %, les 6 Pious demandaient environ 54 runs (≈ 14 en moyenne à 2 %)
    chance: 0.02,
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
  let dossiers = {};
  for (let classe of Object.values(CLASSES)) {
    for (let sortId of classe.sorts) {
      dossiers[sortId] = classe.id;
    }
  }
  for (let monstre of Object.values(MONSTRES)) {
    for (let sortId of monstre.sorts) {
      if (!(sortId in dossiers)) {
        dossiers[sortId] = `monstres`;
      }
    }
  }
  return dossiers;
})();
export function monstresDeZone(zone) {
  let combatIds = [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss];
  let monstres = new Set();
  for (let combatId of combatIds) {
    for (let ennemi of COMBATS[combatId]?.ennemis ?? []) {
      monstres.add(ennemi.monstre);
    }
  }
  return [...monstres];
}
export function bossDeZone(zone) {
  let boss = [];
  for (let combatId of zone.pools.boss) {
    for (let ennemi of COMBATS[combatId]?.ennemis ?? []) {
      if (MONSTRES[ennemi.monstre]?.boss && !boss.includes(ennemi.monstre)) {
        boss.push(ennemi.monstre);
      }
    }
  }
  return boss;
}
export function reliquesDuMonde(mondeId) {
  let monde = MONDES.find((candidat) => candidat.id === mondeId);
  let reliques = [];
  for (let zone of monde ? zonesDuMonde(monde) : []) {
    for (let bossId of bossDeZone(zone)) {
      if (RELIQUES[bossId] && !reliques.includes(bossId)) {
        reliques.push(bossId);
      }
    }
  }
  return reliques;
}

// Relique équipée (E2) : un seul emplacement, un petit bonus qui dépend du monde du boss. Les clés
// sont celles des effets de Dofus, déjà gérées par `bonusDofus`.
export const BONUS_RELIQUE_MONDE = {
  t1: { pvPct: 0.02, desc: `+2 % de PV max` },
  t2: { prospectionPlat: 5, desc: `+5 en prospection` },
  t3: { critPlat: 2, desc: `+2 % de coups critiques` },
  t4: { statsElementaires: 3, desc: `+3 en force, intelligence, agilité et chance` },
  t5: { degatsPct: 0.02, desc: `+2 % de dégâts finaux` },
};
/** Bonus d'une relique de boss (selon le monde où se trouve ce boss), ou undefined. */
export function bonusRelique(id) {
  const monde = MONDES.find((candidat) => reliquesDuMonde(candidat.id).includes(id));
  return monde ? BONUS_RELIQUE_MONDE[monde.id] : undefined;
}
