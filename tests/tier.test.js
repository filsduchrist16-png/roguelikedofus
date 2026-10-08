import { describe, expect, it } from "vitest";
import { EQUIPEMENTS, SECRETS } from "../src/data/index.js";
import { effetsSpeciaux } from "../src/jeu/inventaire.js";
import { instancierObjet } from "../src/jeu/run.js";
import { tierObjet } from "../src/jeu/tier.js";

describe(`Tier des objets`, () => {
  it(`une rareté plus haute du même objet a un Tier plus haut`, () => {
    for (const [id, def] of Object.entries(EQUIPEMENTS)) {
      const r = Object.keys(def.tiers);
      if (!r.includes(`commun`) || !r.includes(`legendaire`)) {
        continue;
      }
      expect(tierObjet(instancierObjet(id, `legendaire`)), id).toBeGreaterThanOrEqual(
        tierObjet(instancierObjet(id, `commun`)),
      );
    }
  });

  it(`les objets de fin de jeu dépassent ceux du début`, () => {
    const moyenne = (ids) =>
      ids.reduce((a, id) => a + tierObjet(instancierObjet(id, `epique`)), 0) / ids.length;
    const debut = SECRETS.t1.butin;
    const fin = SECRETS.t5.butin;
    expect(moyenne(fin)).toBeGreaterThan(moyenne(debut) * 2);
  });

  it(`un PA compte beaucoup, un objet vide vaut 0`, () => {
    expect(tierObjet(null)).toBe(0);
    const base = { id: `abracape`, rarete: `epique`, stats: {}, adaptatif: 0 };
    expect(tierObjet({ ...base, pa: 1 }) - tierObjet(base)).toBe(60);
  });

  it(`« secret » n'est pas un effet spécial`, () => {
    expect(effetsSpeciaux(SECRETS.t1.butin[0])).not.toContain(`secret`);
  });
});
