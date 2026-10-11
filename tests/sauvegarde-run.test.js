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
});
