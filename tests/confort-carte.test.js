import { describe, expect, it } from "vitest";
import { niveauMaxDeZone, ordreRaccourcis, texteCase } from "../src/ui/ecrans/carte.js";
import { COMBATS, MONDES, MONSTRES, ZONES } from "../src/data/index.js";
import { genererCarte, noeudsAtteignables, trouverNoeud } from "../src/carte/generation.js";

describe("texteCase", () => {
  it("décrit un combat : nom du groupe, nombre et noms des monstres", () => {
    const t = texteCase({ type: `combat`, combatId: `abr_2` });
    expect(t.split(`\n`)).toEqual([
      `Combat : Le fil tendu`,
      `3 monstres : Abraknyde Sombre, Arapex, Néfileuse`,
      `🎁 Récompense : butin + 1 carte parmi 3 (relique de run 1 fois sur 5)`,
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

  it("annonce tous les affixes d'un combat dur quand la difficulté en donne plusieurs", () => {
    const deux = texteCase(
      { type: `combat_dur`, combatId: `abr_2`, eliteModifs: [`cuirasse`, `enrage`] },
      2,
    );
    expect(deux).toContain(`Cuirassés : +20 % de PV et +5 % de résistances`);
    expect(deux).toMatch(/Enragés : /);
    expect(deux).not.toMatch(/au hasard/);
    // la carte ne connaît que le premier : le second est tiré au début du combat
    const un = texteCase({ type: `combat_dur`, combatId: `abr_2`, eliteModifs: [`cuirasse`] }, 2);
    expect(un).toContain(`Cuirassés : `);
    expect(un).toContain(`+ 1 autre affixe tiré au hasard au début du combat (difficulté)`);
    // difficulté à un seul affixe : rien de plus
    const seul = texteCase({ type: `combat_dur`, combatId: `abr_2`, eliteModifs: [`cuirasse`] });
    expect(seul).not.toMatch(/au hasard/);
  });

  it("ne répète pas « (dur) » après « Combat dur : »", () => {
    const id = Object.keys(COMBATS).find((k) => COMBATS[k].nom.endsWith(`(dur)`));
    expect(id).toBeTruthy();
    const premiere = texteCase({ type: `combat_dur`, combatId: id }).split(`\n`)[0];
    expect(premiere).toBe(`Combat dur : ${COMBATS[id].nom.replace(` (dur)`, ``)}`);
  });

  it("met le boss du donjon à part, sans répéter « Donjon : »", () => {
    const t = texteCase({ type: `donjon`, combatId: `abr_boss` });
    const lignes = t.split(`\n`);
    expect(lignes[0]).toBe(COMBATS.abr_boss.nom);
    expect(lignes[0]).not.toMatch(/^Donjon : Donjon/);
    expect(lignes[1]).toContain(`Boss : ${MONSTRES.reine_nyee.nom}`);
  });

  it("décrit les cases sans combat par une phrase courte", () => {
    expect(texteCase({ type: `taverne` })).toMatch(/^Taverne : soigne ou recrute\n.*relique/);
    expect(texteCase({ type: `camp` })).toMatch(/^Camp de repos.*\n.*30 %.*\n.*améliorer un sort/);
    expect(texteCase({ type: `coffre` })).toMatch(
      /relique de run ou un objet\n.*piégé : combat ou perte de PV/,
    );
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

// Générateur pseudo-aléatoire à graine (mulberry32) : les 200 cartes sont les mêmes à chaque passage.
const rngGraine = (graine) => {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe("génération de la carte", () => {
  it("le donjon est atteignable depuis le départ, pour 200 graines et chaque zone", () => {
    for (const zone of ZONES) {
      for (let graine = 1; graine <= 200; graine++) {
        const carte = genererCarte(rngGraine(graine), zone.pools, [], {
          premiereZone: graine % 2 === 0,
        });
        const vus = new Set();
        const pile = [...carte.depart];
        while (pile.length) {
          const id = pile.pop();
          if (vus.has(id)) {
            continue;
          }
          vus.add(id);
          pile.push(...trouverNoeud(carte, id).suivants);
        }
        const donjons = carte.noeuds.filter((n) => n.type === `donjon`);
        expect(donjons.length, `${zone.id} graine ${graine}`).toBeGreaterThan(0);
        expect(
          donjons.every((n) => vus.has(n.id)),
          `${zone.id} graine ${graine}`,
        ).toBe(true);
        expect(noeudsAtteignables(carte).length).toBeGreaterThan(0);
      }
    }
  });
});
