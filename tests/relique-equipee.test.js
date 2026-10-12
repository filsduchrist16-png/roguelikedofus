import { beforeEach, describe, expect, it } from "vitest";
import { MONDES, RELIQUES } from "../src/data/index.js";
import { BONUS_RELIQUE_MONDE, bonusRelique, reliquesDuMonde } from "../src/jeu/config.js";
import { bonusDofus, chargerMeta, equiperRelique } from "../src/sauvegarde/meta.js";

beforeEach(() => {
  const m = new Map();
  globalThis.localStorage = {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
});

describe(`Relique équipée (E2)`, () => {
  it(`chaque relique de boss a un bonus, via les clés d'effet des Dofus`, () => {
    for (const id of Object.keys(RELIQUES)) {
      const monde = MONDES.find((m) => reliquesDuMonde(m.id).includes(id));
      if (monde) {
        expect(bonusRelique(id), id).toBe(BONUS_RELIQUE_MONDE[monde.id]);
      }
    }
  });

  it(`n'équipe qu'une relique possédée et ajoute son bonus`, () => {
    const meta = chargerMeta();
    const id = reliquesDuMonde(`t1`)[0];
    expect(meta.reliqueEquipee).toBeUndefined();
    expect(equiperRelique(meta, id)).toBe(false);
    meta.reliques = [id];
    expect(equiperRelique(meta, id)).toBe(true);
    expect(bonusDofus(meta).pvPct).toBeCloseTo(0.02);
    expect(chargerMeta().reliqueEquipee).toBe(id);
    equiperRelique(meta, null);
    expect(bonusDofus(meta).pvPct).toBe(0);
  });

  it(`ignore une relique équipée mais non possédée (sauvegarde abîmée)`, () => {
    const meta = chargerMeta();
    meta.reliqueEquipee = reliquesDuMonde(`t5`)[0];
    expect(bonusDofus(meta).damageMult).toBe(1);
  });
});
