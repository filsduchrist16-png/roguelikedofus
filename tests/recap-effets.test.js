// Récapitulatif des effets actifs en combat (1.9.0) : marqueurs de la pastille et contenu du panneau.
import { describe, expect, it } from "vitest";
import { htmlRecapEffets, marqueursEffets } from "../src/ui/recapEffets.js";

const combattant = (extra = {}) => ({
  nom: `Iop`,
  pvActuels: 30,
  pvMax: 50,
  paActuels: 4,
  paMax: 6,
  bouclier: 0,
  effets: [],
  resistances: {},
  ...extra,
});

describe(`récapitulatif des effets`, () => {
  it(`pastille : rien sans effet ; bouclier, poison puis le nombre d'autres effets`, () => {
    expect(marqueursEffets(combattant(), [])).toBe(``);
    const badges = [
      { texte: `☠ poison 4/t · 2 t`, tip: `Poison` },
      { texte: `⚔ +20 % dgts · 1 t`, tip: `Dégâts` },
      { texte: `🛡 bouclier 12 · 2 t`, tip: `Bouclier` },
    ];
    expect(
      marqueursEffets(
        combattant({ bouclier: 12, effets: [{ stat: `poison`, valeur: 4, toursRestants: 2 }] }),
        badges,
      ),
    ).toBe(`🛡12 ☠ +1`);
  });
  it(`panneau : PV, bouclier, PA, chaque effet avec son texte long, résistances`, () => {
    const html = htmlRecapEffets(combattant({ bouclier: 8 }), [
      { texte: `☠ poison 4/t · 2 t`, tip: `Poison : perd 4 PV. Encore 2 tours.`, classe: `mal` },
    ]);
    expect(html).toContain(`30 / 50 PV`);
    expect(html).toContain(`🛡 8 de bouclier`);
    expect(html).toContain(`4 / 6 PA`);
    expect(html).toContain(`Encore 2 tours.`);
    expect(html).toContain(`re-effet mal`);
    expect(html).toContain(`Résistances`);
    expect(htmlRecapEffets(combattant(), [])).toContain(`Aucun effet actif.`);
  });
  it(`les textes sont échappés`, () => {
    const html = htmlRecapEffets(combattant({ nom: `<b>x</b>` }), [{ texte: `<i>`, tip: `<s>` }]);
    expect(html).not.toContain(`<b>x</b>`);
    expect(html).not.toContain(`<i>`);
  });
});
