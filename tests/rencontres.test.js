import { describe, expect, it } from "vitest";
import { defiReussi, tirerDefi } from "../src/jeu/defis.js";
import {
  BENEDICTIONS,
  bonusEquipeRun,
  idoleActive,
  tirerRencontre,
} from "../src/jeu/rencontres.js";
import { nouvelleRun, combattantsEquipe } from "../src/jeu/run.js";

const fin = (r) => ({
  gagne: true,
  rondes: 3,
  herosKO: false,
  soins: 0,
  degatsParElement: {},
  ordreMorts: [],
  ...r,
});
const ennemis = [
  { ref: `e0`, nom: `Bouftou`, boss: false },
  { ref: `e1`, nom: `Bouftou Royal`, boss: true },
];

describe(`défis de combat`, () => {
  it(`Premier et Dernier suivent l'ordre des monstres achevés`, () => {
    const premier = { id: `premier`, cible: `e1` };
    expect(defiReussi(premier, fin({ ordreMorts: [`e1`, `e0`] }))).toBe(true);
    expect(defiReussi(premier, fin({ ordreMorts: [`e0`, `e1`] }))).toBe(false);
    expect(defiReussi({ id: `dernier`, cible: `e1` }, fin({ ordreMorts: [`e0`, `e1`] }))).toBe(
      true,
    );
  });
  it(`Blitzkrieg, Survivant, Abnégation, Élémentaire`, () => {
    expect(defiReussi({ id: `blitzkrieg`, rondesMax: 3 }, fin({ rondes: 4 }))).toBe(false);
    expect(defiReussi({ id: `survivant` }, fin({ herosKO: true }))).toBe(false);
    expect(defiReussi({ id: `abnegation` }, fin({ soins: 12 }))).toBe(false);
    expect(
      defiReussi({ id: `elementaire`, element: `feu` }, fin({ degatsParElement: { feu: 300 } })),
    ).toBe(true);
    expect(
      defiReussi(
        { id: `elementaire`, element: `feu` },
        fin({ degatsParElement: { feu: 300, air: 20 } }),
      ),
    ).toBe(false);
  });
  it(`un combat perdu ne réussit jamais le défi`, () => {
    expect(defiReussi({ id: `survivant` }, fin({ gagne: false }))).toBe(false);
  });
  it(`les défis tirés sont toujours possibles`, () => {
    const sansSoin = combattantsEquipe(nouvelleRun([`iop`, `sram`]));
    for (let k = 0; k < 200; k++) {
      let a = (k * 7919) % 1000;
      const d = tirerDefi(() => (a = (a * 9301 + 49297) % 233280) / 233280, [ennemis[0]], sansSoin);
      expect([`premier`, `dernier`, `abnegation`]).not.toContain(d.id);
      expect(d.texte.length).toBeGreaterThan(5);
    }
  });
});

describe(`rencontres`, () => {
  it(`une bénédiction s'ajoute aux bonus de l'équipe`, () => {
    const meta = { dofus: [], archis: [] };
    const run = nouvelleRun([`iop`, `cra`]);
    const avant = bonusEquipeRun(meta, run);
    run.benedictions = [`iop`, `sacrieur`];
    const apres = bonusEquipeRun(meta, run);
    expect(apres.damageMult).toBeCloseTo(avant.damageMult * (1 + BENEDICTIONS.iop.effet.degatsPct));
    expect(apres.pvPct).toBeCloseTo(avant.pvPct + 0.1);
  });
  it(`une idole ne vaut que pour sa zone`, () => {
    const run = { idole: { id: `nahuatl`, zone: `astrub` } };
    expect(idoleActive(run, `astrub`)?.pvMult).toBe(1.2);
    expect(idoleActive(run, `tainela`)).toBe(null);
  });
  it(`toutes les rencontres sortent`, () => {
    let a = 1;
    const rng = () => (a = (a * 16807) % 2147483647) / 2147483647;
    const vus = new Set(Array.from({ length: 500 }, () => tirerRencontre(rng)));
    expect([...vus].sort()).toEqual([
      `cle`,
      `coffre`,
      `idoles`,
      `marchand`,
      `sanctuaire`,
      `traque`,
    ]);
  });
});
