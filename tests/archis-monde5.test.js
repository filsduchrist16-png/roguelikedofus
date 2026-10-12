// E1 : le Monde 5 a ses archimonstres et son succès.
import { describe, expect, it } from "vitest";
import { MONDES, MONSTRES, SUCCES } from "../src/data/index.js";
import { progressionArchisMonde, nouvelEtatQuetes, verifierQuetesMeta } from "../src/jeu/quetes.js";

describe(`archimonstres du Monde 5`, () => {
  it(`le Monde 5 compte des archimonstres, tous avec un nom unique`, () => {
    const [, sur] = progressionArchisMonde([], `t5`);
    expect(sur).toBeGreaterThanOrEqual(30);
    const noms = Object.values(MONSTRES)
      .filter((m) => m.archiNom)
      .map((m) => m.archiNom);
    expect(new Set(noms).size).toBe(noms.length);
  });
  it(`le succès « Chasseur d'âmes du Monde 5 » se valide en capturant tout`, () => {
    expect(MONDES.some((m) => m.id === `t5`)).toBe(true);
    expect(SUCCES.t5_5_archimonstres.quetes[0].id).toBe(`t5_archis_tous`);
    const tous = Object.values(MONSTRES)
      .filter((m) => m.archiNom)
      .map((m) => m.id);
    const ctx = (archis) => ({
      archis,
      collection: {},
      dofus: [],
      runs: 0,
      ascension: {},
      reliques: [],
    });
    const ids = (c) => verifierQuetesMeta(nouvelEtatQuetes(), c).quetes.map((q) => q.id);
    expect(ids(ctx([]))).not.toContain(`t5_archis_tous`);
    expect(ids(ctx(tous))).toContain(`t5_archis_tous`);
  });
  it(`les anciens identifiants du Dofus Ocre sont inchangés`, () => {
    expect(SUCCES.dofus_ocre.quetes.map((q) => q.id)).toEqual([
      `ocre_t1`,
      `ocre_t2`,
      `ocre_t3`,
      `ocre_t4`,
      `ocre_t5`,
    ]);
  });
});
