// Effets des Dofus ajoutés.
import { describe, expect, it } from "vitest";
import { DOFUS } from "../src/data/index.js";
import { appliquerBonusDofus, bonusDofus } from "../src/sauvegarde/meta.js";
import { combattantsEquipe, nouvelleRun } from "../src/jeu/run.js";
import { infligerDegats } from "../src/combat/effets.js";

const meta = (...ids) => ({ dofus: ids.map((id) => ({ id })), archis: [] });

describe("Dofus", () => {
  it("chaque Dofus a un effet décrit", () => {
    for (const d of Object.values(DOFUS)) {
      expect(d.desc, d.id).not.toMatch(/à venir/);
    }
  });

  it("Cawotte et Dom de Pin : PV max et bouclier de départ", () => {
    const heros = combattantsEquipe(nouvelleRun(["iop", "cra"], 0, "t1"));
    const pvAvant = heros[0].pvMax;
    appliquerBonusDofus(heros, bonusDofus(meta("dofus_cawotte", "dom_de_pin")));
    expect(heros[0].pvMax).toBe(pvAvant + Math.round(pvAvant * 0.08));
    expect(heros[0].bouclier).toBeGreaterThan(0);
  });

  it("Dokille : le premier héros qui tombe reste à 1 PV, une seule fois", () => {
    const [a, b] = combattantsEquipe(nouvelleRun(["iop", "cra"], 0, "t1"));
    const ctx = { log: () => {}, reliquesActives: new Set(["dokille"]), combatants: [a, b] };
    infligerDegats(a, 9999, undefined, ctx);
    expect(a.pvActuels).toBe(1);
    infligerDegats(b, 9999, undefined, ctx);
    expect(b.pvActuels).toBe(0);
  });

  it("Cacao : multiplie les kamas", () => {
    expect(bonusDofus(meta("dofus_cacao")).multKamas).toBeCloseTo(1.2);
    expect(bonusDofus(meta()).multKamas).toBe(1);
  });
});

describe(`Dofus Ocre`, () => {
  it(`donne son +1 PA dès qu'il est possédé (son succès demande déjà tous les archimonstres)`, async () => {
    const { bonusDofus } = await import(`../src/sauvegarde/meta.js`);
    const meta = {
      dofus: [{ id: `dofus_ocre` }],
      archis: [],
      quetes: { faites: [], compteurs: {} },
    };
    expect(bonusDofus(meta).paBonus).toBe(1);
  });
});
