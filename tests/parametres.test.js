import { beforeEach, describe, expect, it, vi } from "vitest";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`réglages : formation et ordre des héros`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  const charger = async (reglages) => {
    if (reglages !== undefined) {
      localStorage.setItem(`rld_settings_v0`, reglages);
    }
    return (await import(`../src/sauvegarde/parametres.js`)).chargerParametres();
  };

  it(`sans réglages enregistrés : formation et ordre par défaut`, async () => {
    const p = await charger();
    expect(p.formation.iop).toBe(`avant`);
    expect(p.formation.cra).toBe(`arriere`);
    expect(p.ordre.iop).toBe(1);
  });

  it(`une ancienne formation en nombres devient avant (moins de 4) ou arrière`, async () => {
    const p = await charger(JSON.stringify({ formation: { iop: 2, cra: 5 } }));
    expect(p.formation.iop).toBe(`avant`);
    expect(p.formation.cra).toBe(`arriere`);
  });

  it(`une formation illisible est ignorée, les autres réglages restent`, async () => {
    const p = await charger(JSON.stringify({ formation: { iop: `ailleurs` }, autoFinTour: false }));
    expect(p.formation.iop).toBe(`avant`);
    expect(p.autoFinTour).toBe(false);
    const q = await charger(JSON.stringify({ formation: [`avant`] }));
    expect(q.formation.cra).toBe(`arriere`);
  });

  it(`les classes absentes de la formation gardent leur position par défaut`, async () => {
    const p = await charger(JSON.stringify({ formation: { iop: `arriere` } }));
    expect(p.formation.iop).toBe(`arriere`);
    expect(p.formation.feca).toBe(`avant`);
  });

  it(`l'ordre garde les nombres valides et écarte le reste`, async () => {
    const p = await charger(
      JSON.stringify({ ordre: { iop: 7, cra: `x`, feca: null, xelor: NaN } }),
    );
    expect(p.ordre.iop).toBe(7);
    expect(p.ordre.cra).toBe(2);
    expect(p.ordre.feca).toBe(12);
    expect(p.ordre.xelor).toBe(5);
    const q = await charger(JSON.stringify({ ordre: [1, 2] }));
    expect(q.ordre.iop).toBe(1);
  });

  it(`un JSON cassé donne les réglages par défaut`, async () => {
    const p = await charger(`{pas du json`);
    expect(p.taillePolice).toBe(100);
    expect(p.ordre.iop).toBe(1);
  });
});
