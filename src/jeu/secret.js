// Donjons secrets : une clé trouvée pendant la run ouvre, après le boss d'une zone, le donjon secret
// du monde (Château Ensablé, Caverne du Koulosse, Repaire de Skeunk, Cavernes du Kolosso, Chambre de
// Tal Kasha). Ses monstres s'adaptent à la zone où la clé est utilisée : plus tard, c'est plus dur,
// mais la récompense grandit aussi.
import { COMBATS, MONSTRES, SECRETS } from "../data/index.js";
import { ECONOMIE, XP_PAR_COMBAT } from "./config.js";
import { monstresDuCombat } from "./run.js";

export const CHANCES_CLE = {
  // le coffre abandonné contient une clé au lieu d'un objet
  coffre: 0.2,
  // un combat dur gagné laisse une clé
  combatDur: 0.05,
};
// le donjon secret est plus fort que le donjon de la zone
export const PUISSANCE_SECRET = { pv: 1.3, stats: 1.15 };
export const NOMS_CLES = {
  t1: `Clef du Château Ensablé`,
  t2: `Clef de la Caverne du Koulosse`,
  t3: `Clef du Repaire de Skeunk`,
  t4: `Clef secrète des crocs de verre`,
  t5: `Clef de la Chambre de Tal Kasha`,
};

export const secretDuMonde = (trancheId) => SECRETS[trancheId] ?? null;
export const nomCle = (trancheId) => NOMS_CLES[trancheId] ?? `Clef de donjon`;

const STATS_OFF = [`force`, `intelligence`, `agilite`, `chance`];
const statMax = (monstre) => Math.max(...STATS_OFF.map((stat) => monstre.stats?.[stat] ?? 0));
const moyenne = (liste) =>
  liste.length ? liste.reduce((somme, valeur) => somme + valeur, 0) / liste.length : 0;

// Puissance de référence d'une zone : PV totaux des boss de son donjon, statistique offensive des boss
// et des monstres de ses combats normaux.
function referenceZone(zone) {
  const combatBoss = COMBATS[zone.pools.boss[0]];
  const boss = combatBoss.ennemis
    .map((ennemi) => MONSTRES[ennemi.monstre])
    .filter((monstre) => monstre?.boss);
  const normaux = zone.pools.normales.flatMap((combatId) =>
    COMBATS[combatId].ennemis.map((ennemi) => MONSTRES[ennemi.monstre]),
  );
  return {
    pvBoss: boss.reduce((somme, monstre) => somme + monstre.pv, 0),
    statBoss: moyenne(boss.map(statMax)),
    pvNormal: moyenne(normaux.map((monstre) => monstre.pv)),
    statNormal: moyenne(normaux.map(statMax)),
  };
}

/** Monstres du donjon secret, à la puissance de la zone `zone`. */
export function monstresSecrets(trancheId, zone) {
  const secret = secretDuMonde(trancheId);
  const mons = monstresDuCombat(secret.combat);
  const ref = referenceZone(zone);
  const nbBoss = mons.filter((monstre) => MONSTRES[monstre.monstreId]?.boss).length || 1;
  const pvBossData = moyenne(
    mons.filter((monstre) => MONSTRES[monstre.monstreId]?.boss).map((monstre) => monstre.pvMax),
  );
  for (const monstre of mons) {
    const boss = !!MONSTRES[monstre.monstreId]?.boss;
    // chaque boss garde sa part relative (le Kolosso et le Professeur Xa se partagent les PV)
    const pv = boss
      ? (ref.pvBoss / nbBoss) * (monstre.pvMax / pvBossData) * PUISSANCE_SECRET.pv
      : ref.pvNormal * PUISSANCE_SECRET.pv;
    const facteur =
      ((boss ? ref.statBoss : ref.statNormal) * PUISSANCE_SECRET.stats) / (statMax(monstre) || 1);
    monstre.pvBase = monstre.pvMax = monstre.pvActuels = Math.max(10, Math.round(pv));
    for (const st of [...STATS_OFF, `vitalite`]) {
      if (monstre.stats[st] !== undefined) {
        monstre.stats[st] = Math.round(monstre.stats[st] * facteur);
      }
    }
  }
  return mons;
}

/** Récompenses d'une victoire dans le donjon secret, utilisé en toile `toile`. */
export function recompensesSecret(toile) {
  const facteur = 1 + ECONOMIE.gainParToile * (toile - 1);
  return {
    kamas: Math.round(ECONOMIE.gain.donjon * 3 * facteur),
    xp: Math.round(XP_PAR_COMBAT.combat_dur * 2.5),
    // rareté de l'objet garanti
    raretes: { epique: 0.65, legendaire: 0.35 },
  };
}

export function tirerRareteSecret(rng) {
  return rng() < recompensesSecret(1).raretes.legendaire ? `legendaire` : `epique`;
}

// Nombre d'objets garantis par victoire dans le donjon secret (les panoplies de 7 pièces restaient
// hors de portée avec un seul objet).
export const NB_OBJETS_SECRET = 2;
/** Identifiants des objets d'une victoire : `NB_OBJETS_SECRET` pièces différentes du butin secret. */
export function tirerIdsButinSecret(secret, rng) {
  const reste = [...secret.butin];
  const ids = [];
  while (ids.length < NB_OBJETS_SECRET && reste.length) {
    ids.push(reste.splice(Math.floor(rng() * reste.length), 1)[0]);
  }
  return ids;
}
