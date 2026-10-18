// Almanax du jour (1.8.0) : quête quotidienne déterministe, suivi, récompense et sauvegarde.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RELIQUES_RUN } from "../src/data/index.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import { nouvelleRun } from "../src/jeu/run.js";
import {
  QUETES_ALMANAX,
  dateLisible,
  effetAlmanax,
  etatAlmanax,
  normaliserAlmanax,
  progresserAlmanax,
  queteDuJour,
} from "../src/jeu/almanax.js";
import { kamasAlmanax, verserRecompenseAlmanax } from "../src/jeu/almanaxRun.js";
import { nouveauSuiviCombat, suivreEvenement } from "../src/jeu/suiviCombat.js";

const runAvec = (classes = [`iop`, `cra`], champs = {}) =>
  Object.assign(nouvelleRun(classes, 0, `t1`), champs);

describe(`Almanax du jour`, () => {
  it(`même quête pour une date donnée, et des quêtes variées selon les jours`, () => {
    expect(queteDuJour(`2026-10-18`)).toBe(queteDuJour(`2026-10-18`));
    const vues = new Set(
      Array.from({ length: 60 }, (_, i) => queteDuJour(`2026-01-${10 + (i % 20)}-${i}`).id),
    );
    expect(vues.size).toBeGreaterThan(5);
    expect(QUETES_ALMANAX.length).toBeGreaterThanOrEqual(8);
    expect(dateLisible(`2026-10-18`)).toBe(`18 octobre`);
    expect(dateLisible(`2026-03-01`)).toBe(`1er mars`);
  });
  // date dont la quête est « 3 combats sans K.O. »
  const dateSansKo = () => {
    for (let jour = 1; jour < 400; jour++) {
      const date = `2027-01-${String(jour).padStart(3, `0`)}`;
      if (queteDuJour(date).id === `sans_ko`) {
        return date;
      }
    }
    throw new Error(`aucune date`);
  };
  it(`progresse avec les évènements de run, s'accomplit et met une récompense de côté`, () => {
    const date = dateSansKo();
    const meta = {};
    const victoire = { type: `combat`, gagne: true, herosKO: false, noeud: `combat` };
    expect(progresserAlmanax(meta, { ...victoire, herosKO: true }, date).change).toBe(false);
    expect(progresserAlmanax(meta, victoire, date)).toEqual({ change: true, accompli: false });
    expect(etatAlmanax(meta, date).progres).toBe(1);
    expect(effetAlmanax(meta, date)[0].nom).toBe(`Almanax 1/3`);
    progresserAlmanax(meta, victoire, date);
    expect(progresserAlmanax(meta, victoire, date)).toEqual({ change: true, accompli: true });
    expect(etatAlmanax(meta, date).fait).toBe(true);
    expect(meta.almanax.enAttente.type).toMatch(/kamas|relique/);
    // accomplie : plus de progrès ni de pastille sur la carte
    expect(progresserAlmanax(meta, victoire, date).change).toBe(false);
    expect(effetAlmanax(meta, date)).toEqual([]);
    // le lendemain : nouvelle quête, la récompense reste en attente
    const demain = etatAlmanax(meta, `2099-01-01`);
    expect(demain.progres).toBe(0);
    expect(demain.fait).toBe(false);
    expect(demain.enAttente).toEqual(meta.almanax.enAttente);
  });
  it(`compte les coups par élément (suivi du combat)`, () => {
    const suivi = nouveauSuiviCombat();
    const combattants = [
      { ref: `j_iop`, camp: `joueur` },
      { ref: `m_0`, camp: `ennemi` },
    ];
    for (let i = 0; i < 4; i++) {
      suivreEvenement(
        suivi,
        { type: `degats`, element: `terre`, attaquantRef: `j_iop`, montant: 5 },
        combattants,
      );
    }
    suivreEvenement(
      suivi,
      { type: `degats`, element: `terre`, attaquantRef: `m_0`, montant: 5 },
      combattants,
    );
    expect(suivi.coups).toEqual({ terre: 4 });
    const quete = QUETES_ALMANAX.find((q) => q.id === `coups_terre`);
    expect(quete.compte({ type: `combat`, coups: suivi.coups })).toBe(4);
    expect(quete.texte).toBe(`Touche 15 fois un ennemi avec des dégâts de Terre`);
    expect(QUETES_ALMANAX.find((q) => q.id === `coups_eau`).texte).toMatch(/d'Eau$/);
  });
  it(`la récompense est versée une fois au départ de la run suivante`, () => {
    const run = runAvec();
    run.kamas = 0;
    const meta = { almanax: { date: `2026-10-18`, progres: 3, fait: true, enAttente: null } };
    expect(verserRecompenseAlmanax(meta, run)).toBe(``);
    meta.almanax.enAttente = { type: `kamas`, date: `2026-10-18` };
    expect(verserRecompenseAlmanax(meta, run)).toMatch(/kamas de départ/);
    expect(run.kamas).toBe(kamasAlmanax(`t1`));
    expect(meta.almanax.enAttente).toBe(null);
    meta.almanax.enAttente = { type: `relique`, date: `2026-10-18` };
    expect(verserRecompenseAlmanax(meta, run, rngGraine(3))).toMatch(/Almanax/);
    expect(run.reliquesRun.length).toBe(1);
    expect(RELIQUES_RUN[run.reliquesRun[0]].rarete).toBe(`commun`);
    expect(kamasAlmanax(`t5`)).toBeGreaterThan(kamasAlmanax(`t1`));
  });
  it(`lecture d'une sauvegarde : absent = rien, abîmé = oublié`, () => {
    expect(normaliserAlmanax(undefined)).toBe(undefined);
    expect(normaliserAlmanax(`x`)).toBe(undefined);
    expect(
      normaliserAlmanax({ date: `2026-10-18`, progres: 2.7, fait: 1, enAttente: { type: `?` } }),
    ).toEqual({ date: `2026-10-18`, progres: 2, fait: true, enAttente: null });
    expect(
      normaliserAlmanax({ date: 5, enAttente: { type: `kamas`, date: `2026-10-18` } }),
    ).toEqual({
      date: ``,
      progres: 0,
      fait: false,
      enAttente: { type: `kamas`, date: `2026-10-18` },
    });
  });
});

describe(`Almanax : rétrocompatibilité de la méta`, () => {
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
  it(`une méta d'avant la 1.8.0 se charge sans Almanax ; une méta avec Almanax le garde`, async () => {
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, runs: 3, dofus: [] }));
    const { chargerMeta } = await import(`../src/sauvegarde/meta.js`);
    const ancienne = chargerMeta();
    expect(ancienne.runs).toBe(3);
    expect(ancienne.almanax).toBe(undefined);
    expect(etatAlmanax(ancienne, `2026-10-18`).progres).toBe(0);
    const almanax = { date: `2026-10-18`, progres: 1, fait: false, enAttente: null };
    localStorage.setItem(`rld_meta_v0`, JSON.stringify({ version: 4, runs: 3, almanax }));
    expect(chargerMeta().almanax).toEqual(almanax);
  });
});
