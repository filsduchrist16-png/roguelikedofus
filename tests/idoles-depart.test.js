// E3 : idoles de départ (cumulables), records par monde, anciennes sauvegardes.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDOLES_DEPART, idolesDepartValides, scoreRun } from "../src/jeu/idolesDepart.js";
import { IDOLES, effetsEnCours, idoleActive, idoleZone } from "../src/jeu/rencontres.js";
import { nouvelleRun } from "../src/jeu/run.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

describe(`idoles de départ`, () => {
  it(`une run sans idole garde exactement le comportement d'avant`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    expect(run.idolesDepart).toEqual([]);
    expect(idoleActive(run, `incarnam`)).toBe(null);
    run.idole = { id: `nahuatl`, zone: `incarnam` };
    expect(idoleActive(run, `incarnam`)).toBe(IDOLES.nahuatl);
    // ancienne sauvegarde : pas de champ du tout
    delete run.idolesDepart;
    expect(idoleActive(run, `incarnam`)).toBe(IDOLES.nahuatl);
  });
  it(`les idoles choisies au départ se cumulent entre elles et avec celle de la zone`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`, [`rage`, `bastion`, `rage`, `inconnue`]);
    expect(run.idolesDepart).toEqual([`rage`, `bastion`]);
    const e = idoleActive(run, `n_importe_quelle_zone`);
    expect(e.degatsMult).toBeCloseTo(1.15);
    expect(e.pvMult).toBeCloseTo(1.25);
    expect(e.xpMult).toBeCloseTo(1.25);
    expect(e.kamasMult).toBeCloseTo(1.25);
    run.idole = { id: `ultram`, zone: `incarnam` };
    const avecZone = idoleActive(run, `incarnam`);
    expect(avecZone.degatsMult).toBeCloseTo(1.15 * 1.15);
    expect(avecZone.prospection).toBe(40);
    expect(idoleZone(run, `incarnam`)).toBe(IDOLES.ultram);
    expect(idoleZone(run, `autre`)).toBe(null);
  });
  it(`chaque idole a un malus et un bonus affichables, et elles sont listées sur la carte`, () => {
    for (const i of Object.values(IDOLES_DEPART)) {
      expect(i.nom && i.malus && i.bonus).toBeTruthy();
    }
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`, [`gloire`]);
    expect(effetsEnCours(run, `incarnam`).some((x) => x.nom === IDOLES_DEPART.gloire.nom)).toBe(
      true,
    );
  });
  it(`identifiants abîmés : ignorés`, () => {
    expect(idolesDepartValides(`rage`)).toEqual([]);
    expect(idolesDepartValides([`__proto__`, 3, null, `fortune`])).toEqual([`fortune`]);
  });
  it(`le score monte avec les zones, la victoire, la difficulté et les idoles`, () => {
    const base = scoreRun({ zones: 3 });
    expect(base).toBe(300);
    expect(scoreRun({ zones: 3, victoire: true })).toBeGreaterThan(base);
    expect(scoreRun({ zones: 3, ascension: 2 })).toBeGreaterThan(base);
    expect(scoreRun({ zones: 3, idoles: [`rage`] })).toBeGreaterThan(base);
    expect(scoreRun({ zones: 3, idoles: [`gloire`] })).toBeGreaterThan(
      scoreRun({ zones: 3, idoles: [`rage`] }),
    );
  });
});

describe(`sauvegardes et records`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  it(`une ancienne méta sans records se charge, puis un record s'enregistre et se relit`, async () => {
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, dofus: [], archis: [] }));
    const { chargerMeta, enregistrerRecord, recordMonde } = await import(
      `../src/sauvegarde/meta.js`
    );
    const meta = chargerMeta();
    expect(meta.records).toEqual({});
    expect(recordMonde(meta, `t1`)).toBeUndefined();
    expect(enregistrerRecord(meta, `t1`, 400, [`rage`], 1)).toBe(true);
    expect(enregistrerRecord(meta, `t1`, 300, [], 0)).toBe(false);
    expect(chargerMeta().records.t1).toEqual({ score: 400, idoles: [`rage`], ascension: 1 });
  });
  it(`un record abîmé est ignoré sans perdre le reste`, async () => {
    localStorage.setItem(
      `rld_meta_v0`,
      JSON.stringify({
        version: 4,
        dofus: [],
        archis: [`x`],
        records: { t1: { score: `beaucoup` }, t2: { score: 90, idoles: [`rage`, `zzz`] } },
      }),
    );
    const { chargerMeta } = await import(`../src/sauvegarde/meta.js`);
    const meta = chargerMeta();
    expect(meta.archis).toEqual([`x`]);
    expect(meta.records).toEqual({ t2: { score: 90, idoles: [`rage`], ascension: 0 } });
  });
  it(`une ancienne run sans idoles se recharge avec une liste vide`, async () => {
    localStorage.setItem(
      `rld_run_v0`,
      JSON.stringify({
        version: 2,
        zoneIdx: 0,
        run: { trancheId: `t1`, persos: [{ classeId: `iop` }] },
      }),
    );
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    expect(chargerRun().run.idolesDepart).toEqual([]);
  });
});
