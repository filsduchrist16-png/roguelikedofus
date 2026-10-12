// Idoles de départ : choisies à l'accueil avant une run, cumulables, elles durent toute la run.
// Chacune rend les monstres plus forts (malus) contre un bonus de butin, d'XP ou de chance de
// relique (la prospection sert au butin et aux reliques). Mêmes clés d'effet que `IDOLES`
// (rencontres.js), pour que le combat, l'XP et le butin les lisent sans code en plus.
export const IDOLES_DEPART = {
  rage: {
    nom: `Idole de la Rage`,
    malus: `Monstres +15 % de dégâts`,
    bonus: `+25 % d'XP`,
    degatsMult: 1.15,
    xpMult: 1.25,
    points: 1,
  },
  bastion: {
    nom: `Idole du Bastion`,
    malus: `Monstres +25 % de PV`,
    bonus: `+25 % de kamas`,
    pvMult: 1.25,
    kamasMult: 1.25,
    points: 1,
  },
  fortune: {
    nom: `Idole de la Fortune`,
    malus: `Monstres +10 % de PV et +10 % de dégâts`,
    bonus: `+40 en prospection (butin et reliques)`,
    pvMult: 1.1,
    degatsMult: 1.1,
    prospection: 40,
    points: 1,
  },
  gloire: {
    nom: `Idole de la Gloire`,
    malus: `Monstres +20 % de PV et +20 % de dégâts`,
    bonus: `+50 % d'XP, +30 % de kamas et +50 en prospection`,
    pvMult: 1.2,
    degatsMult: 1.2,
    xpMult: 1.5,
    kamasMult: 1.3,
    prospection: 50,
    points: 2,
  },
};

/** Identifiants valides, sans doublon (sauvegarde ou saisie abîmée : on ignore le reste). */
export function idolesDepartValides(ids) {
  return [...new Set(Array.isArray(ids) ? ids : [])].filter(
    (id) => typeof id === `string` && Object.hasOwn(IDOLES_DEPART, id),
  );
}

/** Idoles de départ de la run (ancienne sauvegarde sans le champ : aucune). */
export const idolesDepartDeRun = (run) => idolesDepartValides(run?.idolesDepart);

/** Cumule des idoles : multiplicateurs multipliés, prospection additionnée. */
export function cumulerIdoles(liste) {
  const t = { pvMult: 1, degatsMult: 1, xpMult: 1, kamasMult: 1, prospection: 0 };
  for (const i of liste) {
    t.pvMult *= i.pvMult ?? 1;
    t.degatsMult *= i.degatsMult ?? 1;
    t.xpMult *= i.xpMult ?? 1;
    t.kamasMult *= i.kamasMult ?? 1;
    t.prospection += i.prospection ?? 0;
  }
  return t;
}

/**
 * Score d'une run : zones franchies (+ bonus de victoire), multiplié par la difficulté et par les
 * idoles de départ (chaque point d'idole compte comme un quart de palier).
 */
export function scoreRun({ zones = 0, victoire = false, ascension = 0, idoles = [] }) {
  const points = idolesDepartValides(idoles).reduce((a, id) => a + IDOLES_DEPART[id].points, 0);
  const base = Math.max(0, zones) * 100 + (victoire ? 500 : 0);
  return Math.round(base * (1 + 0.25 * ascension + 0.25 * points));
}
