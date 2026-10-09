import { describe, expect, it } from "vitest";
import { niveauMaxDeZone, ordreRaccourcis, texteCase } from "../src/ui/ecrans/carte.js";
import { COMBATS, MONDES, MONSTRES, ZONES } from "../src/data/index.js";

describe("texteCase", () => {
  it("décrit un combat : nom du groupe, nombre et noms des monstres", () => {
    const t = texteCase({ type: `combat`, combatId: `abr_2` });
    expect(t.split(`\n`)).toEqual([
      `Combat : Le fil tendu`,
      `3 monstres : Abraknyde Sombre, Arapex, Néfileuse`,
    ]);
  });

  it("regroupe les monstres identiques", () => {
    const id = Object.keys(COMBATS).find((k) => {
      const ids = COMBATS[k].ennemis.map((e) => e.monstre);
      return new Set(ids).size < ids.length;
    });
    expect(id).toBeTruthy();
    expect(texteCase({ type: `combat`, combatId: id })).toMatch(/\d× /);
  });

  it("donne l'affixe d'un combat dur en clair", () => {
    const t = texteCase({ type: `combat_dur`, combatId: `abr_2`, eliteModifs: [`cuirasse`] });
    expect(t).toContain(`Combat dur : Le fil tendu`);
    expect(t).toContain(`Cuirassés : +20 % de PV et +5 % de résistances`);
  });

  it("met le boss du donjon à part, sans répéter « Donjon : »", () => {
    const t = texteCase({ type: `donjon`, combatId: `abr_boss` });
    const lignes = t.split(`\n`);
    expect(lignes[0]).toBe(COMBATS.abr_boss.nom);
    expect(lignes[0]).not.toMatch(/^Donjon : Donjon/);
    expect(lignes[1]).toContain(`Boss : ${MONSTRES.reine_nyee.nom}`);
  });

  it("décrit les cases sans combat par une phrase courte", () => {
    expect(texteCase({ type: `taverne` })).toBe(`Taverne : soigne ou recrute`);
    expect(texteCase({ type: `otomai` })).toMatch(/philtre/);
    expect(texteCase({ type: `zaap` })).toMatch(/surprise/);
  });
});

describe("ordreRaccourcis", () => {
  it("numérote les cases de haut en bas", () => {
    expect(
      ordreRaccourcis([
        { id: `b`, x: 100, y: 300 },
        { id: `a`, x: 100, y: 100 },
        { id: `c`, x: 100, y: 200 },
      ]),
    ).toEqual([`a`, `c`, `b`]);
  });
});

describe("niveauMaxDeZone", () => {
  it("donne le plafond du monde qui contient la zone", () => {
    const monde = MONDES[1];
    const zone = ZONES.find((z) => z.id === monde.zones[0]);
    expect(niveauMaxDeZone(zone.nom)).toBe(monde.niveaux[1]);
  });

  it("renvoie null pour une zone inconnue", () => {
    expect(niveauMaxDeZone(`Zone qui n'existe pas`)).toBeNull();
  });
});
