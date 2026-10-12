import { describe, it, expect, beforeEach, vi } from "vitest";
import { chargerMeta } from "../src/sauvegarde/meta.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

describe("meta migration / validation (A2)", () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });

  it("conserve les champs valides même si d'autres sont abîmés", async () => {
    localStorage.setItem(
      "rld_meta_v0",
      JSON.stringify({
        dofus: {},
        archis: ["x"],
        runs: 3,
      }),
    );
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    const meta = charger();
    expect(meta.runs).toBe(3);
    expect(meta.archis).toEqual(["x"]);
    expect(Array.isArray(meta.dofus)).toBe(true);
  });

  it("sauvegarde la donnée brute en cas de JSON invalide", async () => {
    localStorage.setItem("rld_meta_v0", "null");
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    charger();
    expect(localStorage.getItem("rld_meta_corrompue_v0")).toBe("null");
  });

  it("version 1 : les paliers d'ascension sont remis à zéro", async () => {
    localStorage.setItem(
      "rld_meta_v0",
      JSON.stringify({ version: 1, runs: 2, victoires: 1, ascension: { t1: 3 } }),
    );
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    const meta = charger();
    expect(meta.version).toBe(4);
    expect(meta.ascension).toEqual({ t1: 0 });
    expect(meta.runs).toBe(2);
  });

  it("version 1 avec victoires et sans ascension : monde 1 à zéro", async () => {
    localStorage.setItem("rld_meta_v0", JSON.stringify({ version: 1, victoires: 2 }));
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    expect(charger().ascension).toEqual({ t1: 0 });
  });

  it("version 3 : l'ascension est conservée et les anciens succès deviennent des quêtes", async () => {
    localStorage.setItem(
      "rld_meta_v0",
      JSON.stringify({
        version: 3,
        ascension: { t1: 2, t2: 1 },
        succes: ["bapteme_du_feu", "veteran", "inconnu"],
        quetes: { faites: ["g_dix_runs"], compteurs: { a: 1 } },
      }),
    );
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    const meta = charger();
    expect(meta.ascension).toEqual({ t1: 2, t2: 1 });
    expect(meta.quetes.faites).toContain("g_premiere_run");
    expect(meta.quetes.faites.filter((q) => q === "g_dix_runs")).toHaveLength(1);
    expect(meta.quetes.faites).not.toContain("inconnu");
    expect(meta.quetes.compteurs).toEqual({ a: 1 });
  });

  it("version 4 : MIGRATION_SUCCES n'est plus appliquée", async () => {
    localStorage.setItem(
      "rld_meta_v0",
      JSON.stringify({ version: 4, succes: ["bapteme_du_feu"], quetes: { faites: [] } }),
    );
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    expect(charger().quetes.faites).toEqual([]);
  });

  it("Dofus enregistrés sous forme de chaîne : convertis en objets, inconnus écartés", async () => {
    const { DOFUS } = await import("../src/data/index.js");
    const [id] = Object.keys(DOFUS);
    localStorage.setItem(
      "rld_meta_v0",
      JSON.stringify({ version: 3, dofus: [id, "dofus_inexistant", { id }, null] }),
    );
    const { chargerMeta: charger } = await import("../src/sauvegarde/meta.js");
    const meta = charger();
    expect(meta.dofus.map((d) => d.id)).toEqual([id, id]);
    expect(meta.dofus.every((d) => typeof d === "object")).toBe(true);
  });
});
