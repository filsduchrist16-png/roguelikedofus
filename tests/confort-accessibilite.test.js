import { describe, it, expect, beforeEach, vi } from "vitest";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`C13 : réglages d'accessibilité tolérants`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });

  it(`valeurs par défaut sans réglage enregistré`, async () => {
    const { chargerParametres } = await import(`../src/sauvegarde/parametres.js`);
    const p = chargerParametres();
    expect(p.taillePolice).toBe(100);
    expect(p.couleursAdaptees).toBe(false);
  });

  it(`ancienne sauvegarde sans les nouveaux champs : défauts`, async () => {
    localStorage.setItem(`rld_settings_v0`, JSON.stringify({ toucheFinTour: `x` }));
    const { chargerParametres } = await import(`../src/sauvegarde/parametres.js`);
    const p = chargerParametres();
    expect(p.toucheFinTour).toBe(`x`);
    expect(p.taillePolice).toBe(100);
  });

  it(`valeurs abîmées : retour au défaut, valeurs valides conservées`, async () => {
    const { chargerParametres, normaliserTaillePolice } = await import(
      `../src/sauvegarde/parametres.js`
    );
    for (const v of [`gros`, 77, null, {}, [], NaN, 999, ``]) {
      expect(normaliserTaillePolice(v)).toBe(100);
    }
    expect(normaliserTaillePolice(115)).toBe(115);
    expect(normaliserTaillePolice(`130`)).toBe(130);
    localStorage.setItem(
      `rld_settings_v0`,
      JSON.stringify({ taillePolice: 130, couleursAdaptees: `oui` }),
    );
    const p = chargerParametres();
    expect(p.taillePolice).toBe(130);
    expect(p.couleursAdaptees).toBe(false);
  });
});

describe(`C17 : durée des bandeaux`, () => {
  it(`doublée au-delà de 60 caractères`, async () => {
    const { dureeBandeau } = await import(`../src/ui/ecrans/succes.js`);
    expect(dureeBandeau(`court`)).toBe(4000);
    expect(dureeBandeau(`a`.repeat(60))).toBe(4000);
    expect(dureeBandeau(`a`.repeat(61))).toBe(8000);
    expect(dureeBandeau(undefined)).toBe(4000);
  });
});
