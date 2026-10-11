import { beforeEach, describe, expect, it, vi } from "vitest";

function stockage(limite = Infinity) {
  const m = new Map();
  let ecritures = 0;
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      ecritures++;
      if (ecritures > limite) {
        throw new Error(`quota`);
      }
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}
const sauvegarde = (extra = {}) =>
  JSON.stringify({
    jeu: `roguefus-lite`,
    version: 1,
    donnees: {
      rld_meta_v0: { version: 4, runs: 9 },
      rld_settings_v0: { a: 1 },
      rld_run_v0: { b: 2 },
    },
    ...extra,
  });

describe(`import atomique`, () => {
  let e;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.localStorage = stockage();
    e = await import(`../src/sauvegarde/export.js`);
  });

  it(`importe les trois clés`, () => {
    expect(e.importerSauvegarde(sauvegarde())).toBe(true);
    expect(JSON.parse(localStorage.getItem(`rld_meta_v0`)).runs).toBe(9);
    expect(JSON.parse(localStorage.getItem(`rld_run_v0`))).toEqual({ b: 2 });
  });

  it(`une erreur de quota à la 2e écriture laisse les anciennes valeurs intactes`, async () => {
    globalThis.localStorage = stockage(2);
    localStorage.setItem(`rld_meta_v0`, `"ancienne-meta"`); // écriture n°1
    localStorage.setItem(`rld_settings_v0`, `"anciens-reglages"`); // écriture n°2 : le quota est atteint après
    expect(e.importerSauvegarde(sauvegarde())).toBe(false);
    expect(localStorage.getItem(`rld_meta_v0`)).toBe(`"ancienne-meta"`);
    expect(localStorage.getItem(`rld_settings_v0`)).toBe(`"anciens-reglages"`);
    expect(localStorage.getItem(`rld_run_v0`)).toBe(null);
  });

  it(`refuse une version inconnue et des données qui ne sont pas des objets`, () => {
    expect(e.importerSauvegarde(sauvegarde({ version: 99 }))).toBe(false);
    expect(
      e.importerSauvegarde(
        JSON.stringify({
          jeu: `roguefus-lite`,
          version: 1,
          donnees: { rld_meta_v0: {}, rld_run_v0: 5 },
        }),
      ),
    ).toBe(false);
    expect(e.lireSauvegarde(sauvegarde({ version: 2 }))).toBe(null);
    expect(e.lireSauvegarde(sauvegarde())).not.toBe(null);
  });

  it(`la copie de secours se restaure en bloc`, () => {
    localStorage.setItem(`rld_meta_v0`, `{"x":1}`);
    expect(e.sauvegardeDeSecours()).toBe(true);
    e.importerSauvegarde(sauvegarde());
    expect(e.restaurerSecours()).toBe(true);
    expect(localStorage.getItem(`rld_meta_v0`)).toBe(`{"x":1}`);
    expect(localStorage.getItem(`rld_run_v0`)).toBe(null);
  });
});

describe(`échec d'écriture des sauvegardes`, () => {
  it(`sauverRun renvoie false et prévient une seule fois`, async () => {
    vi.resetModules();
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error(`plein`);
      },
      removeItem: () => {},
    };
    const alertes = vi.fn();
    globalThis.addEventListener = (nom, f) =>
      nom === `rld-sauvegarde-echec` && alertes.mockImplementation(f);
    const dispatch = vi.fn();
    globalThis.dispatchEvent = dispatch;
    const { sauverRun } = await import(`../src/sauvegarde/run.js`);
    expect(sauverRun(0, { persos: [] })).toBe(false);
    expect(sauverRun(0, { persos: [] })).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(1);
    delete globalThis.dispatchEvent;
    delete globalThis.addEventListener;
  });
});
