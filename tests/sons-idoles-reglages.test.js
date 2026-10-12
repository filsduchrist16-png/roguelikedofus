import { beforeEach, describe, expect, it, vi } from "vitest";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`réglages : sons`, () => {
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

  it(`par défaut : sons coupés`, async () => {
    const p = await charger();
    expect(p.sons).toBe(false);
  });

  it(`ancien réglage sans ces champs : valeurs par défaut`, async () => {
    const p = await charger(JSON.stringify({ autoFinTour: false }));
    expect(p.sons).toBe(false);
  });

  it(`seul true active les sons`, async () => {
    expect((await charger(JSON.stringify({ sons: true }))).sons).toBe(true);
    for (const v of [`true`, 1, null, `oui`, {}]) {
      expect((await charger(JSON.stringify({ sons: v }))).sons).toBe(false);
    }
  });
});

describe(`sons synthétisés`, () => {
  it(`chaque son a des notes valides, un nom inconnu n'en a aucune`, async () => {
    const { SONS, notesDuSon, VOLUME_SONS } = await import(`../src/son.js`);
    expect(VOLUME_SONS).toBeLessThanOrEqual(0.2);
    for (const nom of [`clic`, `coup`, `soin`, `victoire`, `defaite`]) {
      const notes = notesDuSon(nom);
      expect(notes.length).toBeGreaterThan(0);
      for (const n of notes) {
        expect(n.f).toBeGreaterThan(20);
        expect(n.d).toBeGreaterThan(0);
        expect(n.t).toBeGreaterThanOrEqual(0);
      }
    }
    expect(Object.keys(SONS)).toHaveLength(5);
    expect(notesDuSon(`constructor`)).toEqual([]);
  });

  it(`jouerSon ne fait rien (sans erreur) avant tout geste ou sans WebAudio`, async () => {
    const { jouerSon, definirSons } = await import(`../src/son.js`);
    definirSons(true);
    expect(() => jouerSon(`clic`)).not.toThrow();
  });
});
