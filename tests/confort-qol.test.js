// Passe de confort 1.8.0 : réglages lus de façon tolérante, favoris, logique pure du combat.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  basculerFavori,
  cleFavori,
  estFavori,
  normaliserFavoris,
  normaliserFiltreInventaire,
  normaliserModeAuto,
  normaliserReplis,
  normaliserTriInventaire,
  sectionRepliee,
} from "../src/sauvegarde/parametres.js";
import { SORTS } from "../src/data/index.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun } from "../src/jeu/run.js";
import { ciblesValides, raisonIndisponible } from "../src/combat/stats.js";
import { actionAuto, pvApresCoup } from "../src/ui/combat.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`réglages de confort`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  const charger = async (reglages) => {
    if (reglages !== undefined) {
      localStorage.setItem(`rld_settings_v0`, reglages);
    }
    return (await import(`../src/sauvegarde/parametres.js`)).chargerParametres();
  };
  it(`ancienne sauvegarde (sans les nouvelles clés) : défauts sûrs`, async () => {
    const p = await charger(JSON.stringify({ combatRapide: true }));
    expect(p.combatRapide).toBe(true);
    expect(p.reselectionSort).toBe(true);
    expect(p.cibleUniqueDirecte).toBe(false);
    expect(p.modeAuto).toBe(`heros`);
    expect(p.butinAutoEquiper).toBe(false);
    expect(p.triInventaire).toBe(`toile`);
    expect(p.filtreInventaire).toBe(`tout`);
    expect(p.favoris).toEqual([]);
    expect(p.replis).toEqual({});
  });
  it(`valeurs étrangères : remplacées par les défauts`, async () => {
    const p = await charger(
      JSON.stringify({
        reselectionSort: `oui`,
        cibleUniqueDirecte: 1,
        modeAuto: `tout`,
        butinAutoEquiper: null,
        triInventaire: `<b>`,
        filtreInventaire: `"><img>`,
        favoris: `abc`,
        replis: [1, 2],
      }),
    );
    expect(p.reselectionSort).toBe(true);
    expect(p.cibleUniqueDirecte).toBe(false);
    expect(p.modeAuto).toBe(`heros`);
    expect(p.butinAutoEquiper).toBe(false);
    expect(p.triInventaire).toBe(`toile`);
    expect(p.filtreInventaire).toBe(`tout`);
    expect(p.favoris).toEqual([]);
    expect(p.replis).toEqual({});
  });
  it(`valeurs valides : gardées`, async () => {
    const p = await charger(
      JSON.stringify({
        reselectionSort: false,
        cibleUniqueDirecte: true,
        modeAuto: `combat`,
        triInventaire: `rarete`,
        filtreInventaire: `anneau`,
        replis: { "succes-donjons": true, autre: false },
      }),
    );
    expect(p.reselectionSort).toBe(false);
    expect(p.cibleUniqueDirecte).toBe(true);
    expect(p.modeAuto).toBe(`combat`);
    expect(p.triInventaire).toBe(`rarete`);
    expect(p.filtreInventaire).toBe(`anneau`);
    expect(p.replis).toEqual({ "succes-donjons": true });
    expect(sectionRepliee(p, `succes-donjons`)).toBe(true);
    expect(sectionRepliee(p, `autre`)).toBe(false);
  });
});

describe(`normaliseurs`, () => {
  it(`mode auto, tri, filtre`, () => {
    expect(normaliserModeAuto(`cache`)).toBe(`cache`);
    expect(normaliserModeAuto(undefined)).toBe(`heros`);
    expect(normaliserTriInventaire(`interet`)).toBe(`interet`);
    expect(normaliserTriInventaire(42)).toBe(`toile`);
    expect(normaliserFiltreInventaire(`coiffe`)).toBe(`coiffe`);
    expect(normaliserFiltreInventaire(``)).toBe(`tout`);
  });
  it(`replis : seulement les clés simples à true`, () => {
    expect(normaliserReplis({ a: true, "b c": true, d: 1 })).toEqual({ a: true });
    expect(normaliserReplis(null)).toEqual({});
  });
  it(`favoris : dédoublonnés, chaînes seulement, plafonnés`, () => {
    expect(normaliserFavoris([`a`, `a`, 3, ``, `b`])).toEqual([`a`, `b`]);
    const beaucoup = Array.from({ length: 400 }, (_v, i) => `k${i}`);
    const liste = normaliserFavoris(beaucoup);
    expect(liste.length).toBe(300);
    expect(liste.at(-1)).toBe(`k399`);
  });
});

describe(`favoris`, () => {
  const inst = { id: `coiffe_bouftou`, rarete: `rare`, stats: { vitalite: 10, force: 4 }, pa: 0 };
  it(`la clé ne dépend pas de l'ordre des stats (rechargement de la run)`, () => {
    const recharge = { id: `coiffe_bouftou`, rarete: `rare`, stats: { force: 4, vitalite: 10 } };
    expect(cleFavori(recharge)).toBe(cleFavori(inst));
  });
  it(`des jets différents donnent des clés différentes`, () => {
    expect(cleFavori({ ...inst, stats: { vitalite: 11, force: 4 } })).not.toBe(cleFavori(inst));
    expect(cleFavori({ ...inst, rarete: `epique` })).not.toBe(cleFavori(inst));
  });
  it(`basculer ajoute puis retire`, () => {
    const une = basculerFavori([], inst);
    expect(estFavori(une, inst)).toBe(true);
    expect(estFavori(basculerFavori(une, inst), inst)).toBe(false);
    expect(estFavori(undefined, inst)).toBe(false);
  });
});

function combat(classes) {
  const run = nouvelleRun(classes, 0, `t1`);
  const heros = combattantsEquipe(run);
  const monstres = monstresDuCombat(`abr_1`);
  for (const h of heros) {
    h.toursJoues = 2;
  }
  return { cs: [...heros, ...monstres], heros, monstres };
}

describe(`aperçu des PV après le coup`, () => {
  it(`sans bouclier`, () => {
    expect(pvApresCoup(20, 0, [5, 8])).toEqual([12, 15]);
  });
  it(`le bouclier absorbe d'abord, jamais sous 0`, () => {
    expect(pvApresCoup(20, 6, [5, 8])).toEqual([18, 20]);
    expect(pvApresCoup(4, 0, [5, 8])).toEqual([0, 0]);
  });
});

describe(`jeu automatique d'un héros`, () => {
  it(`un Iop frappe un ennemi valide avec un sort jouable`, () => {
    const { cs, heros } = combat([`iop`, `cra`]);
    const iop = heros[0];
    const action = actionAuto(iop, cs);
    expect(action).not.toBe(null);
    expect(raisonIndisponible(iop, action.sort, cs)).toBe(null);
    const cible = cs.find((c) => c.ref === action.cibleRef);
    expect(cible.camp).toBe(`ennemi`);
    expect(ciblesValides(iop, action.sort, cs).some((c) => c.ref === cible.ref)).toBe(true);
  });
  it(`une Eniripsa soigne un allié en danger, et son mode d'IA est remis`, () => {
    const { cs, heros } = combat([`iop`, `eniripsa`]);
    const [iop, eni] = heros;
    iop.pvActuels = Math.max(1, Math.round(iop.pvMax * 0.2));
    const avant = eni.ia;
    const action = actionAuto(eni, cs);
    expect(action?.sort?.type).toBe(`soin`);
    expect(eni.ia).toBe(avant);
  });
  it(`sans PA : fin du tour (null)`, () => {
    const { cs, heros } = combat([`iop`, `cra`]);
    heros[0].paActuels = 0;
    expect(actionAuto(heros[0], cs)).toBe(null);
  });
  it(`l'action proposée est toujours acceptée par le moteur sur quelques classes`, () => {
    for (const classe of [`cra`, `sram`, `feca`, `osamodas`, `xelor`]) {
      const { cs, heros } = combat([classe, `iop`]);
      const action = actionAuto(heros[0], cs);
      if (action) {
        expect(raisonIndisponible(heros[0], action.sort, cs)).toBe(null);
        expect(SORTS[action.sort.id] ?? heros[0].armeSort).toBeTruthy();
      }
    }
  });
});
