import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIDE_OBTENTION } from "../src/jeu/obtention.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`règles`, () => {
  it(`les trois taux de butin sont affichés séparément (combat dur à 32 %)`, () => {
    expect(AIDE_OBTENTION).toContain(`32 %`);
    expect(AIDE_OBTENTION).toContain(`20 %`);
    expect(AIDE_OBTENTION).toContain(`50 %`);
  });
});

describe(`sauvegarde : résumé et copie de secours`, () => {
  let ex;
  beforeEach(async () => {
    vi.resetModules();
    globalThis.localStorage = stockage();
    ex = await import(`../src/sauvegarde/export.js`);
  });

  it(`résume une sauvegarde exportée`, () => {
    const objet = {
      jeu: `roguefus-lite`,
      date: `2026-09-12T10:00:00.000Z`,
      donnees: {
        rld_meta_v0: {
          dofus: [{ id: `a` }, { id: `b` }],
          quetes: { faites: [`q1`, `q2`, `q3`] },
          archis: [`x`],
        },
        rld_run_v0: { version: 2, zoneIdx: 4, run: { trancheId: `t2` } },
      },
    };
    const r = ex.resumeSauvegarde(objet);
    expect(r).toEqual({
      date: objet.date,
      dofus: 2,
      quetes: 3,
      archis: 1,
      run: `Monde 2 · zone 5`,
    });
    expect(ex.texteResume(r)).toBe(`2 Dofus, 3 quêtes, 1 archimonstre, run Monde 2 · zone 5`);
    expect(ex.resumeSauvegarde({ donnees: { rld_meta_v0: {} } }).run).toBe(null);
    expect(ex.texteResume(ex.resumeSauvegarde({}))).toContain(`aucune run`);
  });

  it(`lit seulement une vraie sauvegarde`, () => {
    expect(ex.lireSauvegarde(`pas du json`)).toBe(null);
    expect(ex.lireSauvegarde(`{"jeu":"autre","donnees":{"rld_meta_v0":{}}}`)).toBe(null);
    expect(ex.lireSauvegarde(`{"jeu":"roguefus-lite","donnees":{"rld_meta_v0":{}}}`)).toBeTruthy();
  });

  it(`la copie de secours permet d'annuler un import`, () => {
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ dofus: [{ id: `ici` }] }));
    localStorage.setItem(`rld_run_v0`, JSON.stringify({ zoneIdx: 2 }));
    expect(ex.infoSecours()).toBe(null);
    const autre = JSON.stringify({
      jeu: `roguefus-lite`,
      donnees: { rld_meta_v0: { dofus: [] } },
    });
    expect(ex.sauvegardeDeSecours()).toBe(true);
    expect(ex.importerSauvegarde(autre)).toBe(true);
    expect(localStorage.getItem(`rld_run_v0`)).toBe(null);
    expect(ex.infoSecours()?.donnees.rld_meta_v0).toContain(`ici`);
    expect(ex.restaurerSecours()).toBe(true);
    expect(JSON.parse(localStorage.getItem(`rld_meta_v0`)).dofus[0].id).toBe(`ici`);
    expect(JSON.parse(localStorage.getItem(`rld_run_v0`)).zoneIdx).toBe(2);
    expect(ex.infoSecours()).toBe(null);
    expect(ex.restaurerSecours()).toBe(false);
  });
});

describe(`sauvegarde en ligne : résumé dans l'en-tête`, () => {
  it(`l'en-tête envoyé porte le résumé ; une ancienne entrée sans résumé reste lisible`, async () => {
    const base = new Map();
    const db = {
      doc: (chemin) => ({
        get: async () => ({
          exists: base.has(chemin),
          data: () => structuredClone(base.get(chemin)),
        }),
        set: async (d) => base.set(chemin, structuredClone(d)),
      }),
    };
    vi.resetModules();
    globalThis.localStorage = stockage();
    globalThis.claude = { use: async (n) => (n === `db` ? db : { id: async () => `u1` }) };
    const nuage = await import(`../src/sauvegarde/nuage.js`);
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ dofus: [{ id: `d` }], archis: [] }));
    await nuage.envoyerNuage();
    expect((await nuage.infoNuage()).resume).toMatchObject({ dofus: 1, run: null });
    const tete = base.get(`data/users/u1/sauvegarde`);
    delete tete.resume;
    base.set(`data/users/u1/sauvegarde`, tete);
    expect((await nuage.infoNuage()).resume).toBe(null);
    // récupérer garde une copie de secours de la partie d'ici
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ dofus: [], archis: [`local`] }));
    expect(await nuage.recupererNuage()).toBe(true);
    expect(localStorage.getItem(`rld_backup_v0`)).toContain(`local`);
    delete globalThis.claude;
  });
});

describe(`accueil : condition d'une difficulté verrouillée`, () => {
  it(`nomme le palier juste en dessous et rappelle par où commencer`, async () => {
    vi.resetModules();
    globalThis.localStorage = stockage();
    const { conditionVerrou } = await import(`../src/ui/ecrans/accueil.js`);
    const { DIFFICULTES } = await import(`../src/jeu/config.js`);
    const proche = conditionVerrou(`t1`, 1, 2);
    expect(proche).toContain(`en ${DIFFICULTES[1].nom} pour débloquer ${DIFFICULTES[2].nom}`);
    expect(proche).not.toContain(`commence`);
    const loin = conditionVerrou(`t1`, 1, 4);
    expect(loin).toContain(`en ${DIFFICULTES[3].nom} pour débloquer ${DIFFICULTES[4].nom}`);
    expect(loin).toContain(`commence par gagner en ${DIFFICULTES[1].nom}`);
  });
});
