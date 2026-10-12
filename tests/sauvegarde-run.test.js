import { describe, it, expect, beforeEach, vi } from "vitest";
import { chargerRun } from "../src/sauvegarde/run.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe("sauvegarde run (A3)", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });

  it("rejette zoneIdx hors limites", async () => {
    localStorage.setItem(
      "rld_run_v0",
      JSON.stringify({
        version: 2,
        zoneIdx: 99,
        run: { trancheId: "t1", persos: [{ classeId: "iop" }] },
      }),
    );
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger()).toBe(null);
  });

  it("rejette zoneIdx négatif", async () => {
    localStorage.setItem(
      "rld_run_v0",
      JSON.stringify({
        version: 2,
        zoneIdx: -1,
        run: { trancheId: "t1", persos: [{ classeId: "iop" }] },
      }),
    );
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger()).toBe(null);
  });

  it("rejette classe inconnue", async () => {
    localStorage.setItem(
      "rld_run_v0",
      JSON.stringify({
        version: 2,
        zoneIdx: 0,
        run: { trancheId: "t1", persos: [{ classeId: "inexistant" }] },
      }),
    );
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger()).toBe(null);
  });

  const ecrire = (run, version = 2, zoneIdx = 0) =>
    localStorage.setItem("rld_run_v0", JSON.stringify({ version, zoneIdx, run }));
  const runMinimale = (extra = {}) => ({
    trancheId: "t1",
    persos: [{ classeId: "iop", equipement: {} }],
    ...extra,
  });

  it("sauverRun puis chargerRun redonnent la run", async () => {
    const { sauverRun, chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(sauverRun(1, runMinimale({ kamas: 12 }))).toBe(true);
    const r = charger();
    expect(r.zoneIdx).toBe(1);
    expect(r.run.kamas).toBe(12);
    expect(r.run.stats.reliques).toEqual([]);
  });

  it("sauverRun renvoie false quand le navigateur refuse d'écrire", async () => {
    const { sauverRun } = await import("../src/sauvegarde/run.js");
    localStorage.setItem = () => {
      throw new Error("quota");
    };
    expect(sauverRun(0, runMinimale())).toBe(false);
  });

  it("rareté inconnue : remplacée par la première rareté de l'objet, stats parasites écartées", async () => {
    const { EQUIPEMENTS } = await import("../src/data/index.js");
    const id = Object.keys(EQUIPEMENTS).find((k) => EQUIPEMENTS[k].tiers);
    const premiere = Object.keys(EQUIPEMENTS[id].tiers)[0];
    ecrire(
      runMinimale({
        inventaire: [
          { id, rarete: "<img onerror=x>", stats: { force: 3, pirate: 9, chance: "x" } },
          { id: "objet_inexistant", rarete: "commun" },
        ],
      }),
    );
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    const inv = charger().run.inventaire;
    expect(inv).toHaveLength(1);
    expect(inv[0].rarete).toBe(premiere);
    expect(inv[0].stats).toEqual({ force: 3 });
  });

  it("objet dont l'emplacement a changé : il retourne dans l'inventaire", async () => {
    const { EQUIPEMENTS } = await import("../src/data/index.js");
    const arme = Object.keys(EQUIPEMENTS).find((k) => EQUIPEMENTS[k].slot === "arme");
    ecrire(
      runMinimale({
        persos: [
          {
            classeId: "iop",
            equipement: {
              cape: { id: arme, rarete: Object.keys(EQUIPEMENTS[arme].tiers)[0] },
              emplacement_fantome: { id: arme },
              arme: { id: "objet_inexistant" },
            },
          },
        ],
      }),
    );
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    const r = charger().run;
    expect(r.persos[0].equipement).toEqual({});
    expect(r.inventaire.map((i) => i.id)).toEqual([arme]);
  });

  it("migration de la version 1 : ascension remise à zéro, champs ajoutés", async () => {
    ecrire(runMinimale({ ascension: 3 }), 1);
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    const r = charger();
    expect(r.run.ascension).toBe(0);
    expect(r.run.kamas).toBe(0);
    expect(r.run.philtres).toBe(0);
    expect(r.run.inventaire).toEqual([]);
  });

  it("version 2 : l'ascension est conservée mais bornée", async () => {
    ecrire(runMinimale({ ascension: 2 }));
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger().run.ascension).toBe(2);
    ecrire(runMinimale({ ascension: 999 }));
    const { DIFFICULTE_MAX } = await import("../src/jeu/config.js");
    expect(charger().run.ascension).toBe(DIFFICULTE_MAX);
  });

  it("l'ancien modificateur d'élite unique devient une liste", async () => {
    ecrire(runMinimale({ carte: { noeuds: [{ id: "n0_0", eliteModif: "cuirasse" }] } }));
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger().run.carte.noeuds[0].eliteModifs).toEqual(["cuirasse"]);
  });

  it("version inconnue ou JSON cassé : null", async () => {
    ecrire(runMinimale(), 3);
    const { chargerRun: charger } = await import("../src/sauvegarde/run.js");
    expect(charger()).toBe(null);
    localStorage.setItem("rld_run_v0", "{cassé");
    expect(charger()).toBe(null);
  });
});
