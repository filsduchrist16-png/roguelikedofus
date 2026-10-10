// Les quêtes qui débloquent les Dofus.
import { describe, expect, it } from "vitest";
import { COMBATS, DOFUS, MONDES, SUCCES, ZONES } from "../src/data/index.js";
import {
  nouvelEtatQuetes,
  verifierQuetesCombat,
  verifierQuetesMeta,
  verifierQuetesZone,
} from "../src/jeu/quetes.js";

const resume = (r) => ({
  zoneId: undefined,
  combatId: "x",
  noeud: "combat",
  gagne: true,
  rondes: 4,
  herosKO: false,
  classes: ["iop"],
  ascension: 0,
  vaincus: [],
  degatsParElement: {},
  soins: 0,
  ...r,
});

describe("succès et Dofus", () => {
  it("chaque Dofus peut être obtenu par un succès", () => {
    const viaSucces = new Set(
      Object.values(SUCCES)
        .map((s) => s.categorie.dofus)
        .filter(Boolean),
    );
    for (const id of Object.keys(DOFUS)) expect(viaSucces.has(id), id).toBe(true);
  });

  it("vaincre un boss sans perdre de héros valide la quête", () => {
    const etat = nouvelEtatQuetes();
    const r = verifierQuetesCombat(etat, resume({ vaincus: ["corruption"], herosKO: true }));
    expect(r.quetes.map((q) => q.id)).not.toContain("dl_dofus_verdoyant_1");
    const r2 = verifierQuetesCombat(etat, resume({ vaincus: ["corruption"] }));
    expect(r2.quetes.map((q) => q.id)).toContain("dl_dofus_verdoyant_1");
  });

  it("les compteurs s'additionnent d'un combat à l'autre", () => {
    const etat = nouvelEtatQuetes();
    const monstres = (n) => Array.from({ length: n }, (_, i) => `m${i}`);
    verifierQuetesCombat(etat, resume({ vaincus: monstres(15) }));
    expect(etat.faites).not.toContain("dl_dofawa_2");
    verifierQuetesCombat(etat, resume({ vaincus: monstres(12) }));
    expect(etat.faites).toContain("dl_dofawa_2");
  });

  it("terminer toutes les quêtes d'un succès le complète (et donne son Dofus)", () => {
    const etat = nouvelEtatQuetes();
    verifierQuetesCombat(etat, resume({ vaincus: ["abraknyde_ancestral"] }));
    const r = verifierQuetesCombat(etat, resume({ vaincus: ["reine_nyee"] }));
    expect(r.succes.map((s) => s.def.categorie.dofus)).toContain("dofus_kaliptus");
  });

  it("terminer une zone valide les quêtes de zone", () => {
    const etat = nouvelEtatQuetes();
    const r = verifierQuetesZone(etat, { zoneId: "incarnam", ascension: 0 });
    expect(r.quetes.map((q) => q.id)).toContain("dl_dofus_argente_1");
  });

  it("posséder un Dofus précis valide la quête qui le demande (mécanisme)", () => {
    const quete = { id: "t_dofus", critere: { type: "dofus_possede", dofus: "dom_de_pin" } };
    const succes = { test: { categorie: {}, quetes: [quete] } };
    const ctx = { archis: [], collection: {}, dofus: [], runs: 0, ascension: {}, reliques: [] };
    const ids = (c) => verifierQuetesMeta(nouvelEtatQuetes(), c, succes).quetes.map((q) => q.id);
    expect(ids(ctx)).not.toContain("t_dofus");
    expect(ids({ ...ctx, dofus: ["dom_de_pin"] })).toContain("t_dofus");
  });

  it("progression linéaire : un Dofus ne demande rien d'un monde plus avancé que le sien", () => {
    const rang = (w) => MONDES.findIndex((m) => m.id === w);
    const mondeZone = (z) => MONDES.find((m) => m.zones.includes(z))?.id;
    const zoneDuBoss = {};
    for (const z of ZONES) {
      for (const c of z.pools?.boss ?? []) {
        for (const e of COMBATS[c].ennemis) zoneDuBoss[e.monstre] ??= z.id;
      }
    }
    let precedent = 0;
    for (const id of Object.keys(DOFUS)) {
      const s = Object.values(SUCCES).find((x) => x.categorie.dofus === id);
      const w = rang(s.categorie.monde);
      expect(w, `${id} rangé dans l'ordre des mondes`).toBeGreaterThanOrEqual(precedent);
      precedent = w;
      for (const q of s.quetes) {
        const c = q.critere;
        const z = c.zone ?? zoneDuBoss[c.boss];
        const besoin = z ? rang(mondeZone(z)) : c.tranche ? rang(c.tranche) : -1;
        expect(besoin, `${id} / ${q.id}`).toBeLessThanOrEqual(w);
      }
    }
  });
});
