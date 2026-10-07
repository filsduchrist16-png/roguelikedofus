import { describe, expect, it } from "vitest";
import { comparerObjet, grouperInventaire } from "../src/jeu/inventaire.js";
import { annulerVente, prixRevente, vendreObjet } from "../src/jeu/economie.js";
import { instancierObjet, nouvelleRun } from "../src/jeu/run.js";
import { EQUIPEMENTS } from "../src/data/index.js";

const premierTier = (id) => Object.keys(EQUIPEMENTS[id].tiers)[0];
const objet = (id, rarete = premierTier(id)) => instancierObjet(id, rarete);

describe(`comparaison d'objets`, () => {
  it(`un objet sur un emplacement vide n'ayant que des gains est une amélioration`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    const id = Object.keys(EQUIPEMENTS).find((k) => {
      const t = EQUIPEMENTS[k].tiers[premierTier(k)];
      return (
        !t.adaptatif &&
        Object.values(t.stats ?? {}).every((v) => v > 0) &&
        !t.resistances &&
        Object.keys(EQUIPEMENTS[k]).length <= 5
      );
    });
    expect(comparerObjet(objet(id), run.persos[0]).verdict).toBe(`mieux`);
  });
  it(`un objet comparé à lui-même ne change rien`, () => {
    const run = nouvelleRun([`iop`]);
    const p = run.persos[0];
    const inst = objet(`abracape`, `epique`);
    p.equipement.cape = inst;
    const c = comparerObjet({ ...inst }, p);
    expect(c.deltas).toEqual([]);
    expect(c.verdict).toBe(`egal`);
  });
  it(`la Force est jugée inutile pour une classe qui ne frappe pas en Terre`, () => {
    const run = nouvelleRun([`cra`]);
    const inst = { ...objet(`abracape`, `epique`), adaptatif: 0, stats: { force: 10 } };
    const d = comparerObjet(inst, run.persos[0]).deltas.find((x) => x.cle === `force`);
    expect(d?.utile).toBe(false);
  });
});

describe(`inventaire`, () => {
  it(`regroupe les exemplaires identiques`, () => {
    const inv = [
      objet(`abracape`, `epique`),
      objet(`abracape`, `legendaire`),
      objet(`abracape`, `epique`),
    ];
    const g = grouperInventaire(inv);
    expect(g.map((x) => x.indices)).toEqual([[0, 2], [1]]);
  });
  it(`une vente peut être annulée`, () => {
    const run = nouvelleRun([`iop`]);
    const inst = objet(`abracape`, `epique`);
    run.inventaire.push(inst);
    const kamas = run.kamas;
    const prix = prixRevente(inst);
    vendreObjet(run, 0);
    expect(run.kamas).toBe(kamas + prix);
    expect(annulerVente(run, inst, prix)).toBe(true);
    expect(run.kamas).toBe(kamas);
    expect(run.inventaire).toEqual([inst]);
  });
});
