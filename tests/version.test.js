import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VERSION } from "../src/version.js";

describe(`version`, () => {
  it(`le numéro affiché est celui de package.json`, () => {
    const pkg = JSON.parse(readFileSync(new URL(`../package.json`, import.meta.url), `utf8`));
    expect(VERSION).toBe(pkg.version);
  });
});

describe(`page de connexion`, () => {
  beforeEach(() => {
    vi.resetModules();
    const m = new Map();
    globalThis.localStorage = {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  });
  it(`proposée tant qu'on n'est pas connecté ni passé en « sans compte »`, async () => {
    const c = await import(`../src/sauvegarde/compte.js`);
    c.configurerCompte({ url: `https://x.example`, cle: `k` });
    expect(c.connexionRequise()).toBe(true);
    c.jouerSansCompte();
    expect(c.connexionRequise()).toBe(false);
    c.seDeconnecter();
    expect(c.connexionRequise()).toBe(true);
  });
  it(`jamais proposée sans serveur configuré`, async () => {
    const c = await import(`../src/sauvegarde/compte.js`);
    c.configurerCompte({ url: ``, cle: `` });
    expect(c.connexionRequise()).toBe(false);
  });
});
