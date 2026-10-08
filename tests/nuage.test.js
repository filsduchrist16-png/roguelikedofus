import { beforeEach, describe, expect, it, vi } from "vitest";

// Base de l'artefact simulée (partagée entre « appareils ») et localStorage propre à chaque appareil.
const base = new Map();
const fauxDb = {
  doc: (chemin) => ({
    get: async () => ({
      exists: base.has(chemin),
      data: () => (base.has(chemin) ? structuredClone(base.get(chemin)) : undefined),
    }),
    set: async (d) => {
      base.set(chemin, structuredClone(d));
    },
  }),
};
function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
async function appareil(agent) {
  vi.resetModules();
  globalThis.localStorage = stockage();
  Object.defineProperty(globalThis, `navigator`, {
    value: { userAgent: agent },
    configurable: true,
  });
  globalThis.claude = { use: async (n) => (n === `db` ? fauxDb : { id: async () => `u1` }) };
  return import(`../src/sauvegarde/nuage.js`);
}

describe(`sauvegarde en ligne`, () => {
  beforeEach(() => base.clear());

  it(`le PC envoie, le mobile récupère la même partie`, async () => {
    const pc = await appareil(`Windows`);
    const meta = { version: 4, dofus: [{ id: `dofawa` }], archis: [`tofu`], runs: 3 };
    localStorage.setItem(`rld_meta_v0`, JSON.stringify(meta));
    localStorage.setItem(
      `rld_run_v0`,
      JSON.stringify({ version: 2, zoneIdx: 4, run: { x: `y`.repeat(400_000) } }),
    );
    expect(await pc.nuageDisponible()).toBe(true);
    await pc.envoyerNuage();
    // la partie est découpée en morceaux sous 256 Kio
    expect([...base.keys()].filter((k) => k.includes(`partie_`)).length).toBeGreaterThan(1);
    expect((await pc.infoNuage()).appareil).toBe(`PC`);

    const mobile = await appareil(`iPhone`);
    expect(await mobile.nuagePlusRecent()).toBeTruthy();
    expect(await mobile.recupererNuage()).toBe(true);
    expect(JSON.parse(localStorage.getItem(`rld_meta_v0`))).toEqual(meta);
    expect(JSON.parse(localStorage.getItem(`rld_run_v0`)).zoneIdx).toBe(4);
    expect(await mobile.nuagePlusRecent()).toBe(null);
  });

  it(`l'envoi automatique n'écrase pas une partie plus récente de l'autre appareil`, async () => {
    const pc = await appareil(`Windows`);
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, dofus: [], runs: 9 }));
    await pc.envoyerNuage();
    const enLigne = base.get(`data/users/u1/sauvegarde`).version;

    const mobile = await appareil(`Android`);
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, dofus: [], runs: 1 }));
    vi.useFakeTimers();
    mobile.signalerChangement();
    await vi.advanceTimersByTimeAsync(20_000);
    vi.useRealTimers();
    expect(base.get(`data/users/u1/sauvegarde`).version).toBe(enLigne);
  });

  it(`hors de l'artefact, tout est indisponible`, async () => {
    vi.resetModules();
    globalThis.localStorage = stockage();
    delete globalThis.claude;
    const n = await import(`../src/sauvegarde/nuage.js`);
    expect(await n.nuageDisponible()).toBe(false);
    expect(await n.recupererNuage()).toBe(false);
  });
});
