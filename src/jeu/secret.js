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
const statMax = (m) => Math.max(...STATS_OFF.map((k) => m.stats?.[k] ?? 0));
const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : 0);

// Puissance de référence d'une zone : PV totaux des boss de son donjon, statistique offensive des boss
// et des monstres de ses combats normaux.
function referenceZone(zone) {
  const combatBoss = COMBATS[zone.pools.boss[0]];
  const boss = combatBoss.ennemis.map((e) => MONSTRES[e.monstre]).filter((m) => m?.boss);
  const normaux = zone.pools.normales.flatMap((c) =>
    COMBATS[c].ennemis.map((e) => MONSTRES[e.monstre]),
  );
  return {
    pvBoss: boss.reduce((a, m) => a + m.pv, 0),
    statBoss: moyenne(boss.map(statMax)),
    pvNormal: moyenne(normaux.map((m) => m.pv)),
    statNormal: moyenne(normaux.map(statMax)),
  };
}

/** Monstres du donjon secret, à la puissance de la zone `zone`. */
export function monstresSecrets(trancheId, zone) {
  const secret = secretDuMonde(trancheId);
  const mons = monstresDuCombat(secret.combat);
  const ref = referenceZone(zone);
  const nbBoss = mons.filter((m) => MONSTRES[m.monstreId]?.boss).length || 1;
  const pvBossData = moyenne(mons.filter((m) => MONSTRES[m.monstreId]?.boss).map((m) => m.pvMax));
  for (const m of mons) {
    const boss = !!MONSTRES[m.monstreId]?.boss;
    // chaque boss garde sa part relative (le Kolosso et le Professeur Xa se partagent les PV)
    const pv = boss
      ? (ref.pvBoss / nbBoss) * (m.pvMax / pvBossData) * PUISSANCE_SECRET.pv
      : ref.pvNormal * PUISSANCE_SECRET.pv;
    const k = ((boss ? ref.statBoss : ref.statNormal) * PUISSANCE_SECRET.stats) / (statMax(m) || 1);
    m.pvBase = m.pvMax = m.pvActuels = Math.max(10, Math.round(pv));
    for (const st of [...STATS_OFF, `vitalite`]) {
      if (m.stats[st] !== undefined) {
        m.stats[st] = Math.round(m.stats[st] * k);
      }
    }
  }
  return mons;
}

/** Récompenses d'une victoire dans le donjon secret, utilisé en toile `toile`. */
export function recompensesSecret(toile) {
  const t = 1 + ECONOMIE.gainParToile * (toile - 1);
  return {
    kamas: Math.round(ECONOMIE.gain.donjon * 3 * t),
    xp: Math.round(XP_PAR_COMBAT.combat_dur * 2.5),
    // rareté de l'objet garanti
    raretes: { epique: 0.65, legendaire: 0.35 },
  };
}

export function tirerRareteSecret(rng) {
  return rng() < recompensesSecret(1).raretes.legendaire ? `legendaire` : `epique`;
}
