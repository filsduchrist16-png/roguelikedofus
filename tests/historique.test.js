// Historique des runs et statistiques du compte (méta 1.9.0) : lecture tolérante, plafond de 20,
// statistiques, temps de jeu.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nouvelleRun } from "../src/jeu/run.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
beforeEach(() => {
  vi.resetModules();
  globalThis.localStorage = stockage();
});
const charger = () => import(`../src/sauvegarde/meta.js`);

describe(`méta : historique et compte`, () => {
  it(`absents (ancienne sauvegarde) : vides`, async () => {
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, runs: 3, dofus: [] }));
    const { chargerMeta } = await charger();
    const meta = chargerMeta();
    expect(meta.historique).toEqual([]);
    expect(meta.compte).toEqual({ tempsJeu: 0, combats: 0, heros: {}, meilleurs: {} });
    expect(meta.runs).toBe(3);
  });
  it(`valeurs abîmées oubliées, le reste gardé`, async () => {
    localStorage.setItem(
      `rld_meta_v0`,
      JSON.stringify({
        version: 4,
        historique: [
          null,
          `x`,
          { date: -1 },
          {
            date: 1700000000000,
            monde: `zz`,
            difficulte: 99,
            issue: `bidon`,
            equipe: [{ classe: `iop`, niveau: 12 }, { classe: `zzz` }],
            reliques: [`rr_trefle`, `bidon`],
            cause: 42,
          },
        ],
        compte: {
          tempsJeu: `x`,
          combats: 7,
          heros: { iop: 3, zzz: 2 },
          meilleurs: { t1: { 1: { zone: 4 } }, zz: {} },
        },
      }),
    );
    const { chargerMeta } = await charger();
    const meta = chargerMeta();
    expect(meta.historique).toHaveLength(1);
    const [entree] = meta.historique;
    expect(entree.monde).toBe(`t1`);
    expect(entree.difficulte).toBe(4);
    expect(entree.issue).toBe(`defaite`);
    expect(entree.equipe).toEqual([{ classe: `iop`, niveau: 12 }]);
    expect(entree.reliques).toEqual([`rr_trefle`]);
    expect(entree.cause).toBe(``);
    expect(meta.compte).toEqual({
      tempsJeu: 0,
      combats: 7,
      heros: { iop: 3 },
      meilleurs: { t1: { 1: { zone: 4, victoires: 0 } } },
    });
  });
  it(`noterFinDeRun : entrée en tête, plafond de 20, statistiques à jour`, async () => {
    const { chargerMeta, noterFinDeRun, MAX_HISTORIQUE, statistiquesCompte } = await charger();
    const meta = chargerMeta();
    const run = nouvelleRun([`iop`, `cra`], 1, `t1`);
    run.stats.combats = 5;
    run.reliquesRun = [`rr_trefle`];
    for (let i = 0; i < MAX_HISTORIQUE + 3; i++) {
      noterFinDeRun(meta, run, {
        issue: `defaite`,
        zone: 2,
        nbZones: 6,
        cause: `Vaincue par X`,
        date: 1000 + i,
      });
    }
    expect(meta.historique).toHaveLength(MAX_HISTORIQUE);
    expect(meta.historique[0].date).toBe(1000 + MAX_HISTORIQUE + 2);
    expect(meta.historique[0]).toMatchObject({
      monde: `t1`,
      difficulte: 1,
      issue: `defaite`,
      zone: 2,
      nbZones: 6,
      cause: `Vaincue par X`,
      reliques: [`rr_trefle`],
      combats: 5,
    });
    noterFinDeRun(
      meta,
      { ...run, persos: run.persos.slice(0, 1) },
      { issue: `victoire`, zone: 6, nbZones: 6 },
    );
    const stats = statistiquesCompte(meta);
    expect(stats.combats).toBe(5 * (MAX_HISTORIQUE + 4));
    expect(stats.herosFavori).toEqual({ classe: `iop`, runs: MAX_HISTORIQUE + 4 });
    const t1 = stats.records.find((record) => record.monde === `t1`);
    expect(t1.parDifficulte[1]).toMatchObject({ gagnee: true, zone: t1.nbZones, victoires: 1 });
    expect(t1.parDifficulte[2]).toMatchObject({ gagnee: false, zone: 0 });
    // sauvegardé et relu à l'identique
    expect(chargerMeta().historique).toEqual(meta.historique);
  });
  it(`une difficulté déjà gagnée avant la 1.9.0 compte comme gagnée`, async () => {
    const { chargerMeta, statistiquesCompte } = await charger();
    const meta = chargerMeta();
    meta.ascension = { t1: 2 };
    const t1 = statistiquesCompte(meta).records.find((record) => record.monde === `t1`);
    expect(t1.parDifficulte.map((cran) => cran.gagnee)).toEqual([true, true, true, false, false]);
  });
  it(`temps de jeu : écart entre deux sauvegardes, pauses plafonnées`, async () => {
    const { noterTempsJeu, PAUSE_TEMPS_JEU, texteDuree } = await charger();
    const meta = {};
    noterTempsJeu(meta, Date.now() + 60_000);
    expect(meta.compte.tempsJeu).toBeGreaterThanOrEqual(59);
    const avant = meta.compte.tempsJeu;
    noterTempsJeu(meta, Date.now() + 60_000 + 10 * PAUSE_TEMPS_JEU);
    expect(meta.compte.tempsJeu - avant).toBe(PAUSE_TEMPS_JEU / 1000);
    expect(texteDuree(30)).toBe(`moins d'une minute`);
    expect(texteDuree(12 * 60)).toBe(`≈ 12 min`);
    expect(texteDuree(3 * 3600 + 5 * 60)).toBe(`≈ 3 h 05`);
  });
});
