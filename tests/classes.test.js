// Mécaniques des classes ajoutées, testées sur des combats préparés à la main.
import { describe, expect, it } from "vitest";
import { SORTS } from "../src/data/index.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun } from "../src/jeu/run.js";
import { lancerSort } from "../src/combat/sorts.js";
import { ciblesValides } from "../src/combat/stats.js";
import { estInfecte } from "../src/combat/classes.js";

// rng fixe : jamais d'esquive ni de critique (valeurs hautes), jets moyens
const ctxTest = (cs) => ({
  rng: () => 0.99,
  log: () => {},
  playerDamageBonus: 1,
  enemyDamageBonus: 1,
  combatants: cs,
});

function combat(classes, combatId) {
  const run = nouvelleRun(classes, 0, "t1");
  const heros = combattantsEquipe(run);
  const monstres = monstresDuCombat(combatId);
  for (const m of monstres) {
    m.pvMax = m.pvBase = m.pvActuels = 500; // assez de PV pour survivre aux tests
  }
  const cs = [...heros, ...monstres];
  return { cs, heros, monstres, ctx: ctxTest(cs) };
}
const lancer = (lanceur, sortId, cible, cs, ctx) => {
  lanceur.paActuels = 20;
  lancerSort(lanceur, SORTS[sortId], cible.ref, cs, ctx);
};

describe("nouvelles classes", () => {
  it("Sadida : Ronce infecte, Contagion se propage aux autres infectés", () => {
    const { cs, heros, monstres, ctx } = combat(["sadida", "iop"], "tof_1");
    const sadida = heros.find((h) => h.ref === "j_sadida");
    const [a, b] = monstres;
    lancer(sadida, "seve_paralysante", a, cs, ctx);
    lancer(sadida, "seve_paralysante", b, cs, ctx);
    expect(estInfecte(a) && estInfecte(b)).toBe(true);
    const pvB = b.pvActuels;
    lancer(sadida, "contagion_sadida", a, cs, ctx);
    expect(b.pvActuels).toBeLessThan(pvB);
  });

  it("Sadida : la poupée se place sur une case libre (plus par-dessus un héros)", () => {
    const { cs, heros, ctx } = combat(["sadida", "iop"], "tof_1");
    const sadida = heros.find((h) => h.ref === "j_sadida");
    lancer(sadida, "la_bloqueuse", sadida, cs, ctx);
    const poupee = cs.find((c) => c.ref === "poupee_j_sadida");
    expect(poupee).toBeDefined();
    const positions = cs
      .filter((c) => c.camp === "joueur" && c.pvActuels > 0)
      .map((c) => c.position);
    expect(new Set(positions).size).toBe(positions.length);
    expect(poupee.pvMax).toBe(Math.round(sadida.pvMax * 0.4));
  });

  it("Osamodas : invoque des créatures qui jouent seules et ne peuvent pas être doublées", () => {
    const { cs, heros, ctx } = combat(["osamodas", "iop"], "tof_1");
    const osa = heros.find((h) => h.ref === "j_osamodas");
    lancer(osa, "invocation_tofu", osa, cs, ctx);
    const tofu = cs.find((c) => c.creature && c.nom === "Tofu");
    expect(tofu?.invoquePar).toBe(osa.ref);
    osa.cooldowns = {};
    expect(ciblesValides(osa, SORTS.invocation_tofu, cs)).toHaveLength(0);
  });

  it("Sacrieur : plus il est blessé, plus il frappe fort", () => {
    const a = combat(["sacrieur", "iop"], "tof_1");
    const b = combat(["sacrieur", "iop"], "tof_1");
    const sacA = a.heros.find((h) => h.ref === "j_sacrieur");
    const sacB = b.heros.find((h) => h.ref === "j_sacrieur");
    sacB.pvActuels = Math.round(sacB.pvMax * 0.2);
    lancer(sacA, "hemorragie", a.monstres[0], a.cs, a.ctx);
    lancer(sacB, "hemorragie", b.monstres[0], b.cs, b.ctx);
    expect(500 - b.monstres[0].pvActuels).toBeGreaterThan(500 - a.monstres[0].pvActuels);
  });

  it("Pandawa : Bombance bascule Sobre ↔ Saoul et Gueule de Bois dessoûle", () => {
    const { cs, heros, monstres, ctx } = combat(["pandawa", "iop"], "tof_1");
    const panda = heros.find((h) => h.ref === "j_pandawa");
    expect(panda.etatClasse).toBe("sobre");
    lancer(panda, "bombance", panda, cs, ctx);
    expect(panda.etatClasse).toBe("saoul");
    lancer(panda, "gueule_de_bois", monstres[0], cs, ctx);
    expect(panda.etatClasse).toBe("sobre");
  });

  it("Huppermage : Feu puis Eau sur la même cible déclenche une combinaison", () => {
    const { cs, heros, monstres, ctx } = combat(["huppermage", "iop"], "tof_1");
    const hupper = heros.find((h) => h.ref === "j_huppermage");
    const cible = monstres[0];
    const journal = [];
    ctx.log = (m) => journal.push(m);
    lancer(hupper, "lance_flamme", cible, cs, ctx);
    expect(cible.marqueElement).toBe("feu");
    lancer(hupper, "stalagmite", cible, cs, ctx);
    expect(journal.some((m) => m.includes("Combinaison élémentaire"))).toBe(true);
    expect(cible.marqueElement).toBeUndefined();
  });

  it("Steamer : Évolution renforce une tourelle", () => {
    const { cs, heros, ctx } = combat(["steamer", "iop"], "tof_1");
    const steamer = heros.find((h) => h.ref === "j_steamer");
    lancer(steamer, "gardienne", steamer, cs, ctx);
    const tourelle = cs.find((c) => c.tourelle);
    expect(tourelle.position).toBeGreaterThanOrEqual(4);
    const pvMax = tourelle.pvMax;
    lancer(steamer, "evolution", tourelle, cs, ctx);
    expect(tourelle.niveauTourelle).toBe(2);
    expect(tourelle.pvMax).toBeGreaterThan(pvMax);
  });

  it("Sacrieur : Transfusion ne peut pas viser le Sacrieur lui-même", () => {
    const { cs, heros } = combat(["sacrieur", "iop"], "tof_1");
    const sac = heros.find((h) => h.ref === "j_sacrieur");
    const cibles = ciblesValides(sac, SORTS.transfusion, cs);
    expect(cibles.some((c) => c.ref === sac.ref)).toBe(false);
    expect(cibles.length).toBeGreaterThan(0);
  });

  it("Zobal : un masque remplace le précédent", () => {
    const { cs, heros, ctx } = combat(["zobal", "iop"], "tof_1");
    const zobal = heros.find((h) => h.ref === "j_zobal");
    lancer(zobal, "masque_psychopathe", zobal, cs, ctx);
    zobal.lancersCeTour = {};
    lancer(zobal, "masque_intrepide", zobal, cs, ctx);
    expect(zobal.etatClasse).toBe("intrepide");
    expect(zobal.effets.filter((e) => e.source === "etat")).toHaveLength(1);
  });
});
