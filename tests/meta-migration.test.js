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
});
