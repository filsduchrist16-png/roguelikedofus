// Lot B : équilibrage et cohérence des règles (soin, esquive, buffs cumulables, effets négatifs…).
import { describe, expect, it } from "vitest";
import { CLASSES, EQUIPEMENTS, SORTS } from "../src/data/index.js";
import { XP_PAR_COMBAT } from "../src/jeu/config.js";
import { genererCarte } from "../src/carte/generation.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun, noeudsExclus } from "../src/jeu/run.js";
import { instancierObjet } from "../src/jeu/run.js";
import { multiplicateurSoin, statsDeNiveau } from "../src/jeu/progression.js";
import { chanceEsquive, multiplicateurRelance, reinitialiserTour } from "../src/combat/stats.js";
import { lancerSort } from "../src/combat/sorts.js";
import { cleEquipement, estProgres } from "../src/jeu/inventaire.js";
import { etatDefi } from "../src/jeu/defis.js";
import { etatObjectif } from "../src/jeu/objectifs.js";
import { nouveauSuiviCombat, resumeCombat } from "../src/jeu/suiviCombat.js";
import { MONDES, ZONES } from "../src/data/index.js";

const ctxTest = (cs) => ({
  rng: () => 0.99,
  log: () => {},
  playerDamageBonus: 1,
  enemyDamageBonus: 1,
  combatants: cs,
});
function combat(classes, combatId) {
  const run = nouvelleRun(classes, 0, `t1`);
  const heros = combattantsEquipe(run);
  const monstres = monstresDuCombat(combatId);
  for (const m of monstres) {
    m.pvMax = m.pvBase = m.pvActuels = 500;
  }
  const cs = [...heros, ...monstres];
  return { cs, heros, monstres, ctx: ctxTest(cs) };
}

describe(`B1 : le soin ne plafonne plus avec l'élément`, () => {
  it(`la stat Soin compte encore avec un élément très élevé`, () => {
    expect(multiplicateurSoin({ soin: 100 }, 300)).toBeGreaterThan(
      multiplicateurSoin({ soin: 0 }, 300),
    );
  });
});

describe(`B2 : esquive d'Agilité à rendement décroissant`, () => {
  const esquive = (agilite) => chanceEsquive({ stats: { agilite }, effets: [], position: 0 });
  it(`valeurs aux niveaux 50, 100 et 200 d'une classe Air`, () => {
    for (const niveau of [50, 100, 200]) {
      const agilite = statsDeNiveau(CLASSES.cra, { niveau, xp: 0 }).agilite;
      const attendu = Math.min(0.35, agilite / (agilite + 400));
      expect(esquive(agilite)).toBeCloseTo(attendu, 6);
    }
  });
  it(`plafonnée à 35 %`, () => {
    expect(esquive(100000)).toBeLessThanOrEqual(0.35);
  });
});

describe(`B3 : Tir puissant non cumulable`, () => {
  it(`3 lancers en 3 tours : critique total d'au plus 15`, () => {
    const { cs, heros, monstres, ctx } = combat([`cra`, `iop`], `tof_1`);
    const cra = heros.find((h) => h.ref === `j_cra`);
    const avant = cra.effets.filter((e) => e.stat === `crit`).reduce((a, e) => a + e.valeur, 0);
    for (let i = 0; i < 3; i++) {
      reinitialiserTour(cra);
      cra.paActuels = 20;
      lancerSort(cra, SORTS.tir_puissant, cra.ref, cs, ctx);
    }
    const apres = cra.effets.filter((e) => e.stat === `crit`).reduce((a, e) => a + e.valeur, 0);
    expect(apres - avant).toBeLessThanOrEqual(15);
    expect(apres - avant).toBeGreaterThan(0);
    expect(monstres.length).toBeGreaterThan(0);
  });
});

describe(`B4 : Colère de Iop plafonnée`, () => {
  it(`le bonus ne dépasse pas +150 %`, () => {
    const sort = SORTS.colere_de_iop;
    const lanceur = { lancersCombat: { colere_de_iop: 10 } };
    expect(multiplicateurRelance(sort, lanceur)).toBeCloseTo(2.5, 6);
    expect(multiplicateurRelance(sort, { lancersCombat: { colere_de_iop: 2 } })).toBeCloseTo(2, 6);
  });
});

describe(`B5 : « Équiper le meilleur » et la Chance d'Ecaflip`, () => {
  it(`un anneau paGamble fait baisser les PA de la clé et n'est pas préféré`, () => {
    const a = nouvelleRun([`iop`]).persos[0];
    const b = nouvelleRun([`iop`]).persos[0];
    a.equipement.anneau = instancierObjet(`chance_d_ecaflip`, `epique`);
    expect(cleEquipement(a).pa).toBeLessThan(cleEquipement(b).pa);
    // retirer l'anneau est un progrès, le remettre n'en est pas un
    expect(estProgres(a, b)).toBe(true);
    expect(estProgres(b, a)).toBe(false);
  });
});

describe(`B8 : pas d'Otomai là où il n'y a pas d'archimonstre`, () => {
  it(`Monde 5 : la case otomai est exclue et ne sort jamais`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t5`);
    const zone = ZONES.find((z) => z.id === MONDES.find((m) => m.id === `t5`).zones[0]);
    const exclus = noeudsExclus(run, zone);
    expect(exclus).toContain(`otomai`);
    for (let i = 0; i < 40; i++) {
      const carte = genererCarte(Math.random, zone.pools, exclus, { premiereZone: false });
      expect(JSON.stringify(carte)).not.toContain(`"otomai"`);
    }
  });
  it(`Monde 1 : Otomai reste possible`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    expect(noeudsExclus(run, {})).not.toContain(`otomai`);
  });
});

describe(`B9 : XP du donjon`, () => {
  it(`le donjon a une entrée dans XP_PAR_COMBAT`, () => {
    expect(XP_PAR_COMBAT.donjon).toBeGreaterThan(0);
  });
});

describe(`B10 : héros déjà K.O. au départ`, () => {
  const heros = (ref, pv) => ({ ref, camp: `joueur`, pvActuels: pv });
  const ennemi = { ref: `m`, monstreId: `bouftou`, camp: `ennemi`, pvActuels: 10 };
  it(`Survivant : un héros K.O. avant le combat ne rate pas le défi`, () => {
    const cs = [heros(`h1`, 10), heros(`h2`, 0), ennemi];
    const s = nouveauSuiviCombat();
    s.herosDepart = [`h1`];
    expect(etatDefi({ id: `survivant` }, s, cs).etat).not.toBe(`rate`);
    cs[0].pvActuels = 0;
    expect(etatDefi({ id: `survivant` }, s, cs).etat).toBe(`rate`);
  });
  it(`objectif sans K.O. : même règle`, () => {
    const cs = [heros(`h1`, 10), heros(`h2`, 0), ennemi];
    const s = nouveauSuiviCombat();
    s.herosDepart = [`h1`];
    const o = { suivi: { type: `vaincre`, boss: `x`, sansKO: true } };
    expect(etatObjectif(o, s, cs).etat).not.toBe(`rate`);
    cs[0].pvActuels = 0;
    expect(etatObjectif(o, s, cs).etat).toBe(`rate`);
  });
});

describe(`B13 : invocations ignorées dans l'ordre des monstres vaincus`, () => {
  it(`ordreVaincus ne contient pas les invocations`, () => {
    const cs = [
      { ref: `a`, monstreId: `bouftou`, camp: `ennemi`, pvActuels: 0 },
      { ref: `i`, monstreId: `tofu`, camp: `ennemi`, pvActuels: 0, invoquePar: `a` },
      { ref: `h`, camp: `joueur`, pvActuels: 5 },
    ];
    const suivi = nouveauSuiviCombat();
    suivi.morts.add(`i`);
    suivi.morts.add(`a`);
    const r = resumeCombat(suivi, { combattants: cs, herosVivantsAuDepart: [`h`], gagne: true });
    expect(r.ordreVaincus).toEqual([`bouftou`]);
  });
  it(`l'Anneau Tissé donne une esquive fixe`, () => {
    expect(EQUIPEMENTS.anneau_tisse.esquiveBonus).toBe(0.025);
    expect(EQUIPEMENTS.anneau_tisse.esquiveParPiece).toBeUndefined();
  });
});
