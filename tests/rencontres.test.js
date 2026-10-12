import { describe, expect, it } from "vitest";
import { defiReussi, tirerDefi } from "../src/jeu/defis.js";
import {
  BENEDICTIONS,
  bonusEquipeRun,
  PV_TEMPLE,
  forgerGratuit,
  herosKO,
  idoleActive,
  objetsForgeables,
  prixTemple,
  releverHeros,
  rencontresExclues,
  tirerRencontre,
} from "../src/jeu/rencontres.js";
import { EQUIPEMENTS } from "../src/data/index.js";
import { rareteSuivante } from "../src/jeu/economie.js";
import { instancierObjet, nouvelleRun, combattantsEquipe, pvMaxPerso } from "../src/jeu/run.js";

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
      `forgemage`,
      `idoles`,
      `marchand`,
      `sanctuaire`,
      `temple`,
      `traque`,
    ]);
  });
});

describe(`E5 : forgemage itinérant et temple de résurrection`, () => {
  const rngFixe = (v) => () => v;
  it(`le forgemage et le temple sortent, et peuvent être exclus du tirage`, () => {
    let a = 7;
    const rng = () => (a = (a * 16807) % 2147483647) / 2147483647;
    const vus = new Set(Array.from({ length: 800 }, () => tirerRencontre(rng)));
    expect(vus.has(`forgemage`)).toBe(true);
    expect(vus.has(`temple`)).toBe(true);
    for (let v = 0; v < 1; v += 0.01) {
      expect(tirerRencontre(rngFixe(v), [`forgemage`, `temple`])).not.toMatch(/forgemage|temple/);
    }
  });
  it(`le temple n'est proposé que s'il y a un K.O. et jamais en mort définitive`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    expect(rencontresExclues(run)).toContain(`temple`);
    run.persos[0].pvActuels = 0;
    expect(rencontresExclues(run)).not.toContain(`temple`);
    expect(rencontresExclues(run, { mortDefinitive: true })).toContain(`temple`);
  });
  it(`relever un héros lui rend la moitié de ses PV max, sans toucher un héros debout`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    const [a, b] = run.persos;
    a.pvActuels = 0;
    const avant = b.pvActuels;
    expect(releverHeros(b)).toBe(false);
    expect(b.pvActuels).toBe(avant);
    expect(releverHeros(a)).toBe(true);
    expect(a.pvActuels).toBe(Math.round(pvMaxPerso(a) * PV_TEMPLE));
    expect(herosKO(run)).toEqual([]);
    expect(prixTemple(3)).toBeGreaterThan(prixTemple(1));
  });
  it(`le forgemage monte un objet d'un palier, sans frais`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    const inst = Object.keys(EQUIPEMENTS)
      .map((id) => instancierObjet(id, `commun`))
      .find((o) => o && rareteSuivante(o));
    const suivante = rareteSuivante(inst);
    expect(suivante).toBeTruthy();
    run.inventaire.push(inst);
    const kamas = run.kamas;
    expect(objetsForgeables(run)).toContain(inst);
    expect(rencontresExclues(run)).not.toContain(`forgemage`);
    expect(forgerGratuit(inst)).toBe(true);
    expect(inst.rarete).toBe(suivante);
    expect(run.kamas).toBe(kamas);
  });
  it(`sans objet à monter, le forgemage est exclu`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    run.inventaire.length = 0;
    for (const p of run.persos) {
      p.equipement = {};
    }
    expect(rencontresExclues(run)).toContain(`forgemage`);
  });
});
