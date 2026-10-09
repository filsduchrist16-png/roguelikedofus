import { describe, expect, it } from "vitest";
import { CONFIG_ARCHI, DIFFICULTES } from "../src/jeu/config.js";
import {
  apercuSoin,
  gagnerXpPerso,
  herosVivants,
  noeudsExclus,
  nouvelleRun,
  peutGagnerXp,
  pvMaxPerso,
} from "../src/jeu/run.js";
import { basculerClasse } from "../src/ui/ecrans/choixEquipe.js";
import { deblocagesVictoire, etatDeblocage } from "../src/ui/ecrans/recap.js";
import { texteBilan } from "../src/ui/finCombat.js";

const ULTIME = DIFFICULTES.findIndex((d) => d.id === `ultime`);

describe(`choix de l'équipe`, () => {
  it(`une 3e classe remplace la plus ancienne, un 2e appui retire`, () => {
    expect(basculerClasse([], `iop`)).toEqual([`iop`]);
    expect(basculerClasse([`iop`, `cra`], `sram`)).toEqual([`cra`, `sram`]);
    expect(basculerClasse([`iop`, `cra`], `iop`)).toEqual([`cra`]);
  });
});

describe(`bilan de fin de combat`, () => {
  it(`compose XP, kamas, défi et niveaux`, () => {
    expect(texteBilan({ xp: 120, kamas: 45 })).toBe(`+120 XP · +45 k`);
    expect(texteBilan({ xp: 120, kamas: 45, defiOk: true, niveaux: 2 })).toBe(
      `+120 XP · +45 k (défi +30 %) · ⬆ 2 niveaux`,
    );
    expect(texteBilan({ kamas: 300 })).toBe(`+300 k`);
  });
});

describe(`noeuds exclus`, () => {
  it(`Ultime : la taverne n'est coupée qu'avec 4 héros debout`, () => {
    const run = nouvelleRun([`iop`, `cra`, `sram`, `feca`], ULTIME, `t1`);
    expect(noeudsExclus(run, { sansNoeuds: [] })).toContain(`taverne`);
    run.persos[0].pvActuels = 0;
    expect(herosVivants(run)).toBe(3);
    expect(noeudsExclus(run, { sansNoeuds: [] })).not.toContain(`taverne`);
  });
  it(`plus d'Otomai une fois les philtres au maximum`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    expect(noeudsExclus(run, {})).not.toContain(`otomai`);
    run.philtres = CONFIG_ARCHI.philtresMax;
    expect(noeudsExclus(run, {})).toContain(`otomai`);
  });
});

describe(`aperçu du soin de taverne`, () => {
  it(`compte les PV réellement rendus et les héros relevés`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    const [a, b] = run.persos;
    expect(apercuSoin(run.persos, 0.5).total).toBe(0);
    a.pvActuels = 0;
    b.pvActuels = pvMaxPerso(b) - 10;
    const apercu = apercuSoin(run.persos, 0.5);
    expect(apercu.total).toBe(Math.round(pvMaxPerso(a) * 0.5) + 10);
    expect(apercu.releves).toEqual([a.classeId]);
    // mort définitive : le héros tombé ne se relève pas
    expect(apercuSoin(run.persos, 0.5, true)).toEqual({ total: 10, releves: [] });
  });
});

describe(`déblocages d'une victoire`, () => {
  it(`annonce la difficulté suivante et le monde suivant`, () => {
    const meta = { ascension: {} };
    const avant = etatDeblocage(meta, `t1`);
    meta.ascension.t1 = 0;
    const lignes = deblocagesVictoire(avant, etatDeblocage(meta, `t1`));
    expect(lignes).toContain(`difficulté ${DIFFICULTES[1].nom}`);
    expect(lignes).toContain(`Monde 2`);
    // rejouer la même difficulté ne débloque rien de nouveau
    const encore = etatDeblocage(meta, `t1`);
    expect(deblocagesVictoire(encore, etatDeblocage(meta, `t1`))).toEqual([]);
  });
});

describe(`XP au plafond du monde`, () => {
  it(`un héros au niveau max du monde ne peut plus gagner d'XP`, () => {
    const run = nouvelleRun();
    const p = run.persos[0];
    expect(peutGagnerXp(p, run.trancheId)).toBe(true);
    while (peutGagnerXp(p, run.trancheId)) {
      gagnerXpPerso(p, 100000, run.trancheId);
    }
    const xpAvant = p.progression.xp;
    expect(gagnerXpPerso(p, 500, run.trancheId)).toBe(0);
    expect(p.progression.xp).toBe(xpAvant);
  });
});
