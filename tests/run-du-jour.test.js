// E4 : run du jour (graine de la date locale, bénédiction imposée, record à part).
import { describe, expect, it } from "vitest";
import { genererCarte } from "../src/carte/generation.js";
import { BENEDICTIONS, bonusEquipeRun } from "../src/jeu/rencontres.js";
import { nouvelleRun } from "../src/jeu/run.js";
import {
  benedictionDuJour,
  cleRecordJour,
  dateDuJour,
  graineDeTexte,
  rngCarteDuJour,
  rngGraine,
} from "../src/jeu/runDuJour.js";
import { enregistrerRecord, recordMonde } from "../src/sauvegarde/meta.js";

const POOLS = { normales: [`a`, `b`, `c`, `d`], elite: [`e`, `f`], boss: [`g`] };

describe(`run du jour`, () => {
  it(`la date est celle du calendrier local, au format AAAA-MM-JJ`, () => {
    expect(dateDuJour(new Date(2026, 0, 5, 23, 59))).toBe(`2026-01-05`);
    expect(dateDuJour(new Date(2026, 11, 31, 0, 0))).toBe(`2026-12-31`);
  });
  it(`la même graine donne la même suite, une autre graine une autre`, () => {
    const suite = (g) => {
      const r = rngGraine(g);
      return Array.from({ length: 5 }, r);
    };
    expect(suite(42)).toEqual(suite(42));
    expect(suite(42)).not.toEqual(suite(43));
    expect(suite(graineDeTexte(`a`))).not.toEqual(suite(graineDeTexte(`b`)));
    for (const x of suite(7)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it(`la bénédiction du jour est stable et valide, et varie selon les jours`, () => {
    expect(benedictionDuJour(`2026-10-12`)).toBe(benedictionDuJour(`2026-10-12`));
    const vues = new Set();
    for (let j = 1; j <= 60; j++) {
      const id = benedictionDuJour(`2026-11-${String(j).padStart(2, `0`)}`);
      expect(BENEDICTIONS[id]).toBeTruthy();
      vues.add(id);
    }
    expect(vues.size).toBeGreaterThan(3);
  });
  it(`la carte d'une zone est la même un jour donné, différente d'un jour ou d'une zone à l'autre`, () => {
    const carte = (date, monde, zone) =>
      JSON.stringify(genererCarte(rngCarteDuJour(date, monde, zone), POOLS));
    expect(carte(`2026-10-12`, `t1`, 0)).toBe(carte(`2026-10-12`, `t1`, 0));
    expect(carte(`2026-10-12`, `t1`, 0)).not.toBe(carte(`2026-10-13`, `t1`, 0));
    expect(carte(`2026-10-12`, `t1`, 0)).not.toBe(carte(`2026-10-12`, `t1`, 1));
  });
  it(`la run du jour impose la bénédiction ; une run normale n'a ni date ni bénédiction`, () => {
    const normale = nouvelleRun([`iop`, `cra`], 0, `t1`);
    expect(normale.jour).toBeUndefined();
    expect(normale.benedictions).toBeUndefined();
    const date = `2026-10-12`;
    const benediction = benedictionDuJour(date);
    const jour = nouvelleRun([`iop`, `cra`], 0, `t1`, [`rage`], { date, benediction });
    expect(jour.jour).toBe(date);
    expect(jour.benedictions).toEqual([benediction]);
    const meta = { dofus: [], archis: [] };
    expect(bonusEquipeRun(meta, jour)).not.toEqual(bonusEquipeRun(meta, normale));
  });
  it(`le record du jour est à part du record du monde`, () => {
    const meta = { records: {} };
    const cle = cleRecordJour(`2026-10-12`, `t1`);
    expect(cle).not.toBe(`t1`);
    expect(enregistrerRecord(meta, cle, 300)).toBe(true);
    expect(recordMonde(meta, cle).score).toBe(300);
    expect(recordMonde(meta, `t1`)).toBeUndefined();
    expect(enregistrerRecord(meta, cle, 200)).toBe(false);
  });
});
