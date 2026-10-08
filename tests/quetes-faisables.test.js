import { describe, expect, it } from "vitest";
import {
  COMBATS,
  DOFUS,
  MONDES,
  MONSTRES,
  RELIQUES,
  SECRETS,
  SUCCES,
  ZONES,
} from "../src/data/index.js";
import { butinDeZone } from "../src/jeu/config.js";

// Chaque quête doit pouvoir se faire : sinon un Dofus devient impossible et, comme ils s'obtiennent
// dans l'ordre, tous les Dofus de niveau supérieur avec lui.
describe(`quêtes faisables`, () => {
  const rencontres = new Set();
  for (const z of ZONES) {
    for (const l of Object.values(z.pools ?? {})) {
      for (const c of l) {
        COMBATS[c].ennemis.forEach((e) => rencontres.add(e.monstre));
      }
    }
  }
  for (const s of Object.values(SECRETS)) {
    COMBATS[s.combat].ennemis.forEach((e) => rencontres.add(e.monstre));
  }
  const tombe = new Set(SECRETS ? Object.values(SECRETS).flatMap((s) => s.butin) : []);
  for (const z of ZONES) {
    Object.values(butinDeZone(z.id) ?? {}).forEach((l) => l.forEach((id) => tombe.add(id)));
  }
  const quetes = Object.entries(SUCCES).flatMap(([sid, s]) => s.quetes.map((q) => [sid, q]));

  it(`les boss, monstres, zones et mondes demandés existent et se rencontrent`, () => {
    for (const [sid, { critere: c }] of quetes) {
      if (c.boss) {
        expect(rencontres.has(c.boss), `${sid} : ${c.boss}`).toBe(true);
      }
      if (c.espece) {
        expect(rencontres.has(c.espece), `${sid} : ${c.espece}`).toBe(true);
      }
      if (c.zone) {
        expect(
          ZONES.some((z) => z.id === c.zone),
          `${sid} : ${c.zone}`,
        ).toBe(true);
      }
      if (c.tranche) {
        expect(
          MONDES.some((m) => m.id === c.tranche),
          `${sid} : ${c.tranche}`,
        ).toBe(true);
      }
    }
  });

  it(`les objets, reliques et Dofus demandés s'obtiennent`, () => {
    for (const [sid, { critere: c }] of quetes) {
      if (c.type === `objet_obtenu`) {
        expect(tombe.has(c.objet), `${sid} : ${c.objet} doit tomber quelque part`).toBe(true);
      }
      if (c.type === `relique_obtenue`) {
        expect(RELIQUES[c.boss], `${sid} : relique de ${c.boss}`).toBeTruthy();
        expect(rencontres.has(c.boss), `${sid} : ${c.boss}`).toBe(true);
      }
      if (c.type === `dofus_possede`) {
        expect(DOFUS[c.dofus], `${sid} : ${c.dofus}`).toBeTruthy();
      }
    }
    expect(Object.keys(MONSTRES).length).toBeGreaterThan(0);
  });
});
