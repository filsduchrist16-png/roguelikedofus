import { beforeEach, describe, expect, it, vi } from "vitest";

describe(`C12 : astuces de première partie`, () => {
  beforeEach(() => {
    vi.resetModules();
    const m = new Map();
    globalThis.localStorage = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  });

  it(`normaliserVuTuto : lecture tolérante des anciens réglages`, async () => {
    const { normaliserVuTuto, CLES_TUTO } = await import(`../src/sauvegarde/parametres.js`);
    expect(normaliserVuTuto(undefined)).toBeNull();
    expect(normaliserVuTuto(`oui`)).toBeNull();
    expect(normaliserVuTuto([true])).toBeNull();
    const tout = normaliserVuTuto(true);
    expect(CLES_TUTO.every((k) => tout[k] === true)).toBe(true);
    const part = normaliserVuTuto({ carte: true, combat: `x`, inconnu: true });
    expect(part).toEqual({ carte: true, combat: false, butin: false, taverne: false });
  });

  it(`tutoVu`, async () => {
    const { tutoVu } = await import(`../src/sauvegarde/parametres.js`);
    expect(tutoVu(null, `carte`)).toBe(false);
    expect(tutoVu({ carte: true }, `carte`)).toBe(true);
    expect(tutoVu({ carte: true }, `combat`)).toBe(false);
  });

  it(`ancienne sauvegarde sans vuTuto : null ; objet conservé`, async () => {
    const { chargerParametres } = await import(`../src/sauvegarde/parametres.js`);
    localStorage.setItem(`rld_settings_v0`, JSON.stringify({ toucheFinTour: `x` }));
    expect(chargerParametres().vuTuto).toBeNull();
    localStorage.setItem(`rld_settings_v0`, JSON.stringify({ vuTuto: { carte: true } }));
    expect(chargerParametres().vuTuto.carte).toBe(true);
  });
});
