import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.useRealTimers());

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
    expect(base.get(`data/users/u1/sauvegarde`).version).toBe(enLigne);
  });

  it(`la découpe ne coupe jamais un emoji en deux`, async () => {
    const pc = await appareil(`Windows`);
    const texte = `a`.repeat(9) + `😀`.repeat(10);
    const morceaux = pc.decouper(texte, 10);
    expect(morceaux.join(``)).toBe(texte);
    for (const m of morceaux) {
      expect(/[\ud800-\udbff]$/.test(m)).toBe(false);
    }
  });

  it(`une récupération impossible dit pourquoi (morceau manquant, partie abîmée)`, async () => {
    const pc = await appareil(`Windows`);
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, dofus: [], runs: 1 }));
    localStorage.setItem(
      `rld_run_v0`,
      JSON.stringify({ version: 2, run: { x: `y`.repeat(400_000) } }),
    );
    await pc.envoyerNuage();
    const tete = base.get(`data/users/u1/sauvegarde`);
    const mobile = await appareil(`iPhone`);
    const chemin = `data/users/u1/partie_${tete.slot}_1`;
    const garde = base.get(chemin);
    base.delete(chemin);
    expect(await mobile.recupererNuage()).toBe(false);
    expect(mobile.raisonEchecNuage()).toMatch(/absent/);
    // contenu tronqué : partie abîmée
    base.set(chemin, { version: tete.version, texte: `x` });
    expect(await mobile.recupererNuage()).toBe(false);
    expect(mobile.raisonEchecNuage()).toMatch(/abîmée/);
    base.set(chemin, garde);
    expect(await mobile.recupererNuage()).toBe(true);
  });

  it(`les envois alternent deux emplacements et une version mélangée valide reste récupérable`, async () => {
    const pc = await appareil(`Windows`);
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, dofus: [], runs: 1 }));
    await pc.envoyerNuage();
    const premier = base.get(`data/users/u1/sauvegarde`).slot;
    await pc.envoyerNuage();
    const second = base.get(`data/users/u1/sauvegarde`).slot;
    expect(second).not.toBe(premier);
    // un autre appareil a réécrit le morceau avec sa propre version, mais le contenu est valide
    const tete = base.get(`data/users/u1/sauvegarde`);
    const chemin = `data/users/u1/partie_${tete.slot}_0`;
    base.set(chemin, { ...base.get(chemin), version: `autre` });
    const mobile = await appareil(`iPhone`);
    expect(await mobile.recupererNuage()).toBe(true);
  });

  it(`les anciennes sauvegardes (morceaux partie_k sans emplacement) se récupèrent encore`, async () => {
    const meta = { version: 4, dofus: [{ id: `dofawa` }], runs: 2 };
    const texte = JSON.stringify({
      jeu: `roguefus-lite`,
      version: 1,
      donnees: { rld_meta_v0: meta },
    });
    base.set(`data/users/u1/sauvegarde`, {
      version: `v1`,
      n: 1,
      date: `2026-01-01`,
      appareil: `PC`,
    });
    base.set(`data/users/u1/partie_0`, { version: `v1`, texte });
    const mobile = await appareil(`iPhone`);
    expect(await mobile.recupererNuage()).toBe(true);
    expect(JSON.parse(localStorage.getItem(`rld_meta_v0`))).toEqual(meta);
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
