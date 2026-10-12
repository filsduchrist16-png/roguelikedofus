import { describe, expect, it } from "vitest";
import { DOFUS } from "../src/data/index.js";

describe(`Dofus de fin de jeu (E6)`, () => {
  it(`Ébène, Dofawa et Domakuro ne sont plus négligeables`, () => {
    expect(DOFUS.dofus_ebene.degatsPct).toBeGreaterThanOrEqual(0.05);
    expect(DOFUS.dofawa.pvBonus).toBeGreaterThanOrEqual(10);
    expect(DOFUS.domakuro.desc).toContain(`8 %`);
  });

  it(`le texte du Kaliptus ne parle plus de « meilleur exemplaire »`, () => {
    expect(DOFUS.dofus_kaliptus.desc).not.toContain(`meilleur exemplaire`);
    expect(DOFUS.dofus_kaliptus.prospectionJet).toEqual([1, 30]);
  });
});
