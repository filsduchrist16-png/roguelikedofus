// Simule des milliers de combats complets (sans interface) avec des choix aléatoires
// pour détecter plantages, boucles infinies et états incohérents du moteur.
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASSES, COMBATS, DOFUS, EQUIPEMENTS, SORTS } from "../src/data/index.js";
import { DIFFICULTES } from "../src/jeu/config.js";
import {
  appliquerAffixesElite,
  appliquerDifficulteMonstres,
  classesJouables,
  combattantsEquipe,
  effetsDifficulte,
  instancierObjet,
  monstresDuCombat,
  nouvelleRun,
  recruter,
  tirerArchis,
} from "../src/jeu/run.js";
import { appliquerBonusDofus, bonusDofus } from "../src/sauvegarde/meta.js";
import { executerCombat } from "../src/combat/moteur.js";
import { choisirActionIA } from "../src/combat/ia.js";
import { ciblesValides, coutPA } from "../src/combat/stats.js";

function rngSeed(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// contrôleur joueur aléatoire : n'importe quel sort jouable (arme comprise) sur n'importe quelle cible valide
const controleurAleatoire = (rng) => (lanceur, combattants) => {
  const sorts = [lanceur.armeSort, ...lanceur.sorts.map((id) => SORTS[id])].filter(Boolean);
  const jouables = sorts
    .map((sort) => ({ sort, cibles: ciblesValides(lanceur, sort, combattants) }))
    .filter(({ sort, cibles }) => cibles.length && lanceur.paActuels >= coutPA(sort, lanceur));
  if (!jouables.length || rng() < 0.05) return null;
  const { sort, cibles } = jouables[Math.floor(rng() * jouables.length)];
  return { sort, cibleRef: cibles[Math.floor(rng() * cibles.length)].ref };
};

function equiperAleatoirement(run, rng) {
  const ids = Object.keys(EQUIPEMENTS);
  for (const perso of run.persos) {
    for (let k = 0; k < 6; k++) {
      const id = ids[Math.floor(rng() * ids.length)];
      const raretes = Object.keys(EQUIPEMENTS[id].tiers ?? {});
      if (!raretes.length) continue;
      const inst = instancierObjet(id, raretes[Math.floor(rng() * raretes.length)]);
      if (EQUIPEMENTS[id].ligneAvant && perso.position >= 4) continue;
      perso.equipement[EQUIPEMENTS[id].slot] = inst;
    }
  }
}

function invariant(c, ctx) {
  for (const x of c) {
    if (!Number.isFinite(x.pvActuels) || !Number.isFinite(x.pvMax))
      throw new Error(`${ctx}: PV non numériques pour ${x.ref} (${x.pvActuels}/${x.pvMax})`);
    if (x.pvActuels < 0) throw new Error(`${ctx}: PV négatifs pour ${x.ref}`);
    if (x.pvActuels > x.pvMax + 1e-9 && !x.estLance)
      throw new Error(`${ctx}: PV au-dessus du max pour ${x.ref} (${x.pvActuels}/${x.pvMax})`);
    if (!Number.isFinite(x.paActuels) || x.paActuels < 0)
      throw new Error(`${ctx}: PA invalides pour ${x.ref} (${x.paActuels})`);
    if (!Number.isFinite(x.bouclier) || x.bouclier < 0)
      throw new Error(`${ctx}: bouclier invalide pour ${x.ref} (${x.bouclier})`);
  }
}

describe("moteur de combat (fuzz)", () => {
  const classes = classesJouables();
  const combats = Object.keys(COMBATS);
  const N = Number(process.env.FUZZ_N ?? 600);

  it(`joue ${N} combats aléatoires sans erreur`, async () => {
    const resume = [];
    for (let i = 0; i < N; i++) {
      const rng = rngSeed(1000 + i);
      const nb = 2 + Math.floor(rng() * 3);
      const equipe = [];
      while (equipe.length < nb) {
        const c = classes[Math.floor(rng() * classes.length)];
        if (!equipe.includes(c)) equipe.push(c);
      }
      const ascension = Math.floor(rng() * DIFFICULTES.length);
      const run = nouvelleRun(equipe.slice(0, 2), ascension, rng() < 0.5 ? "t1" : "t2");
      for (const c of equipe.slice(2)) recruter(run, c);
      for (const p of run.persos) p.progression.niveau = 1 + Math.floor(rng() * 100);
      if (rng() < 0.7) equiperAleatoirement(run, rng);
      const combatId = combats[Math.floor(rng() * combats.length)];
      const heros = combattantsEquipe(run);
      for (const h of heros) h.pvActuels = h.pvMax;
      const monstres = monstresDuCombat(combatId);
      appliquerDifficulteMonstres(monstres, effetsDifficulte(ascension), { type: "combat", rng });
      if (rng() < 0.3) appliquerAffixesElite(monstres, rng);
      tirerArchis(monstres, rng, 0.3);
      const dofusIds = Object.keys(DOFUS).filter(() => rng() < 0.3);
      const meta = { dofus: dofusIds.map((id) => ({ id, jet: 10 })), archis: [] };
      const bonus = bonusDofus(meta);
      appliquerBonusDofus(heros, bonus);
      const c = [...heros, ...monstres];
      const ctx = `combat #${i} ${combatId} [${equipe}] asc ${ascension}`;
      let actions = 0;
      const resultat = await executerCombat(c, {
        rng,
        controllers: {
          joueur: (l, cs) => {
            actions++;
            return controleurAleatoire(rng)(l, cs);
          },
          ennemi: (l, cs) => {
            actions++;
            return choisirActionIA(l, cs);
          },
        },
        onUpdate: () => invariant(c, ctx),
        playerDamageBonus: bonus.damageMult,
        enemyDamageBonus: effetsDifficulte(ascension).degatsMult ?? 1,
        reliquesActives: new Set(dofusIds),
      }).catch((err) => {
        throw new Error(`${ctx}: ${err.stack}`);
      });
      resume.push(
        `${i} ${resultat} ${actions} ${c.map((x) => `${x.ref}:${x.pvActuels}`).join(",")}`,
      );
      expect(typeof resultat, ctx).toBe("boolean");
      expect(actions, ctx).toBeLessThan(20000);
    }
    if (process.env.FUZZ_DIGEST) writeFileSync(process.env.FUZZ_DIGEST, resume.join("\n"));
  }, 600_000);
});
