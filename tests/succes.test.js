// Les quêtes qui débloquent les Dofus.
import { describe, expect, it } from "vitest";
import { DOFUS, SUCCES } from "../src/data/index.js";
import { nouvelEtatQuetes, verifierQuetesCombat, verifierQuetesZone } from "../src/jeu/quetes.js";

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
    const r = verifierQuetesCombat(etat, resume({ vaincus: ["bouftou_royal"], herosKO: true }));
    expect(r.quetes.map((q) => q.id)).not.toContain("d_dofus_turquoise_1");
    const r2 = verifierQuetesCombat(etat, resume({ vaincus: ["bouftou_royal"] }));
    expect(r2.quetes.map((q) => q.id)).toContain("d_dofus_turquoise_1");
  });

  it("les compteurs s'additionnent d'un combat à l'autre", () => {
    const etat = nouvelEtatQuetes();
    verifierQuetesCombat(etat, resume({ degatsParElement: { terre: 1200 } }));
    expect(etat.faites).not.toContain("d_dofus_pourpre_1");
    verifierQuetesCombat(etat, resume({ degatsParElement: { terre: 900 } }));
    expect(etat.faites).toContain("d_dofus_pourpre_1");
  });

  it("terminer toutes les quêtes d'un succès le complète (et donne son Dofus)", () => {
    const etat = nouvelEtatQuetes();
    verifierQuetesCombat(etat, resume({ vaincus: ["wa_wabbit"] }));
    const r = verifierQuetesCombat(etat, resume({ vaincus: ["wa_wobot"] }));
    expect(r.succes.map((s) => s.def.categorie.dofus)).toContain("dofus_cawotte");
  });

  it("terminer une zone valide les quêtes de zone", () => {
    const etat = nouvelEtatQuetes();
    const r = verifierQuetesZone(etat, { zoneId: "astrub", ascension: 0 });
    expect(r.quetes.map((q) => q.id)).toContain("d_dofawa_2");
  });
});
