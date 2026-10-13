// IA des monstres : situations construites où le bon choix est évident pour un joueur.
import { describe, expect, it } from "vitest";
import { SORTS } from "../src/data/index.js";
import { choisirActionIA, estimerDegats } from "../src/combat/ia.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun } from "../src/jeu/run.js";

// deux ou trois héros en première ligne, PV pleins
function heros(classes) {
  const equipe = combattantsEquipe(nouvelleRun(classes, 0, `t1`));
  equipe.forEach((h, i) => {
    h.position = i;
    h.pvActuels = h.pvMax;
  });
  return equipe;
}

// un monstre du Monde 1 dont on choisit les sorts, les PA et l'IA
function monstre(sorts, { pa = 6, ia = `agressif` } = {}) {
  const m = monstresDuCombat(`abr_1`)[0];
  m.sorts = sorts;
  m.paMax = m.paActuels = pa;
  m.ia = ia;
  m.position = 0;
  return m;
}

describe(`IA ennemie`, () => {
  it(`achève le héros à 5 PV plutôt que de taper le héros plein`, () => {
    const [a, b] = heros([`iop`, `cra`]);
    a.pvMax = a.pvActuels = 500;
    b.pvActuels = 5;
    const m = monstre([`morsure`], { pa: 4 });
    const action = choisirActionIA(m, [a, b, m]);
    expect(action.sort.id).toBe(`morsure`);
    expect(action.cibleRef).toBe(b.ref);
  });

  it(`achève avec le petit sort et garde ses PA pour frapper ailleurs`, () => {
    const [a, b] = heros([`iop`, `cra`]);
    a.pvMax = a.pvActuels = 500;
    b.pvActuels = 3;
    // 7 PA : Picotement (3 PA) suffit pour achever, il reste 4 PA pour Morsure sur l'autre
    const m = monstre([`morsure`, `picotement`], { pa: 7 });
    const action = choisirActionIA(m, [a, b, m]);
    expect(action.sort.id).toBe(`picotement`);
    expect(action.cibleRef).toBe(b.ref);
  });

  it(`vise le soigneur plutôt qu'un héros aussi blessé qui ne soigne pas`, () => {
    const [iop, eni] = heros([`iop`, `eniripsa`]);
    iop.pvActuels = iop.pvMax = 200;
    eni.pvActuels = eni.pvMax = 200;
    const m = monstre([`morsure`], { pa: 4 });
    const action = choisirActionIA(m, [iop, eni, m]);
    expect(action.cibleRef).toBe(eni.ref);
  });

  it(`ne gaspille pas un coup sur un héros déjà condamné par son poison`, () => {
    const [a, b] = heros([`iop`, `cra`]);
    a.pvMax = a.pvActuels = 500;
    b.pvMax = 500;
    b.pvActuels = 30;
    b.effets.push({ stat: `poison`, valeur: 40, toursRestants: 2 });
    const m = monstre([`morsure`], { pa: 4 });
    const action = choisirActionIA(m, [a, b, m]);
    expect(action.cibleRef).toBe(a.ref);
  });

  it(`ne tape jamais un allié et renvoie null sans PA`, () => {
    const [a] = heros([`iop`, `cra`]);
    const m = monstre([`morsure`], { pa: 2 });
    expect(choisirActionIA(m, [a, m])).toBeNull();
  });

  it(`le soutien soigne un allié en danger, mais pas un allié presque plein`, () => {
    const [a] = heros([`iop`, `cra`]);
    a.pvActuels = a.pvMax = 400;
    const soigneur = monstre([`soin_noir`, `morsure`], { pa: 4, ia: `soutien` });
    const allie = monstre([`morsure`]);
    allie.ref = `allie`;
    allie.position = 1;
    allie.pvMax = allie.pvActuels = 100;
    allie.pvActuels = 97;
    let action = choisirActionIA(soigneur, [a, soigneur, allie]);
    expect(action.sort.id).toBe(`morsure`);
    allie.pvActuels = 25;
    action = choisirActionIA(soigneur, [a, soigneur, allie]);
    expect(action.sort.id).toBe(`soin_noir`);
    expect(action.cibleRef).toBe(`allie`);
  });

  it(`l'estimation des dégâts est déterministe et ne touche pas aux combattants`, () => {
    const [a] = heros([`iop`, `cra`]);
    const m = monstre([`morsure`]);
    const copie = structuredClone(a);
    const d1 = estimerDegats(m, SORTS.morsure, a);
    const d2 = estimerDegats(m, SORTS.morsure, a);
    expect(d1).toBe(d2);
    expect(d1).toBeGreaterThan(0);
    expect(a).toEqual(copie);
  });
});
