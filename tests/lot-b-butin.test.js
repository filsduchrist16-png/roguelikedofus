// Lot B (B6, B7, B11) : panoplies de boss/secrets atteignables, Pious plus faciles à trouver.
import { describe, expect, it } from "vitest";
import { BUTIN_ZONES, COMBATS, SECRETS } from "../src/data/index.js";
import POOLS_ZONES from "../src/data/poolsZones.json";
import { MONSTRES_RARES } from "../src/jeu/config.js";
import { NB_OBJETS_SECRET, tirerIdsButinSecret } from "../src/jeu/secret.js";

describe("B6 : pièces de boss", () => {
  it("chaque pièce du pool boss est aussi dans les élites de sa zone", () => {
    for (const [z, d] of Object.entries(BUTIN_ZONES)) {
      for (const id of d.boss) {
        expect(d.elites, `zone ${z} : ${id}`).toContain(id);
      }
    }
  });
});

describe("B7 : donjons secrets", () => {
  it("une victoire donne plusieurs objets différents du butin du secret", () => {
    for (const [t, secret] of Object.entries(SECRETS)) {
      const ids = tirerIdsButinSecret(secret, Math.random);
      expect(ids).toHaveLength(Math.min(NB_OBJETS_SECRET, secret.butin.length));
      expect(new Set(ids).size, t).toBe(ids.length);
      for (const id of ids) {
        expect(secret.butin).toContain(id);
      }
    }
    expect(NB_OBJETS_SECRET).toBeGreaterThanOrEqual(2);
  });
});

describe("B11 : Pious du Monde 1", () => {
  it("la chance d'apparition est d'au moins 2 %", () => {
    expect(MONSTRES_RARES.t1.chance).toBeGreaterThanOrEqual(0.02);
  });
});

describe("B12 : variété des combats", () => {
  const ORPHELINS = ["rat_sio", "crapeur", "bwork_elemental_de_terre", "harpo", "n_yalg"];
  it("chaque zone a 5 combats normaux composés de monstres de sa zone", () => {
    for (const [zone, pool] of Object.entries(POOLS_ZONES)) {
      expect(pool.normales, zone).toHaveLength(5);
      const tailles = pool.normales.map((id) => COMBATS[id].ennemis.length);
      expect(Math.max(...tailles) - Math.min(...tailles), zone).toBeLessThanOrEqual(3);
      for (const id of pool.normales) {
        expect(COMBATS[id], id).toBeDefined();
      }
    }
  });
  it("les monstres orphelins servent dans un combat normal", () => {
    const utilises = new Set(
      Object.values(POOLS_ZONES).flatMap((p) =>
        p.normales.flatMap((id) => COMBATS[id].ennemis.map((e) => e.monstre)),
      ),
    );
    for (const m of ORPHELINS) {
      expect(utilises.has(m), m).toBe(true);
    }
  });
});
