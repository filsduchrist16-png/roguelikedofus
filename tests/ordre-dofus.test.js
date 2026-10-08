import { describe, expect, it } from "vitest";
import { DOFUS, MONDES, SUCCES } from "../src/data/index.js";
import { dofusDeSucces, nouvelEtatQuetes } from "../src/jeu/quetes.js";
import { mondeDuDofus } from "../src/jeu/obtention.js";
import {
  ajouterDofus,
  chargerMeta,
  sauverMeta,
  dofusAGagner,
  dofusDebloquables,
  dofusManquantsAvant,
  remettreDofusEnOrdre,
} from "../src/sauvegarde/meta.js";

const metaVide = () => ({ dofus: [], quetes: nouvelEtatQuetes(), archis: [], reliques: [] });
const succesDe = (id) => Object.values(SUCCES).find((s) => dofusDeSucces(s) === id);
const terminer = (meta, id) => meta.quetes.faites.push(...succesDe(id).quetes.map((q) => q.id));
const avant = (id) =>
  Object.values(DOFUS)
    .filter((d) => d.niveau < DOFUS[id].niveau)
    .map((d) => d.id);

describe(`ordre d'obtention des Dofus (Dofus 3)`, () => {
  it(`les niveaux suivent les mondes : un Dofus de niveau 200 n'est pas avant le Monde 4`, () => {
    const ordre = MONDES.map((m) => m.id);
    for (const d of Object.values(DOFUS)) {
      const m = ordre.indexOf(mondeDuDofus(d.id)?.id);
      expect(m, d.id).toBeGreaterThanOrEqual(0);
      if (d.niveau >= 200) {
        expect(m, d.id).toBeGreaterThanOrEqual(3);
      }
    }
    // succès de niveau 200 dans Dofus 3
    for (const id of [`dolmanax`, `dokille`, `dofoozbz`, `dofus_des_glaces`, `dofus_ebene`]) {
      expect(DOFUS[id].niveau, id).toBe(200);
    }
    expect(DOFUS.dofus_emeraude.niveau).toBeLessThan(DOFUS.dofus_pourpre.niveau);
    expect(DOFUS.dofus_pourpre.niveau).toBeLessThan(DOFUS.domakuro.niveau);
  });

  it(`un Dofus attend tous ceux de niveau inférieur`, () => {
    const meta = metaVide();
    terminer(meta, `dofus_ebene`);
    expect(dofusAGagner(meta, succesDe(`dofus_ebene`))).toBe(undefined);
    expect(dofusManquantsAvant(meta, `dofus_ebene`)).toEqual(avant(`dofus_ebene`));
    // une fois les prérequis possédés, il se débloque tout seul
    for (const id of avant(`dofus_ebene`)) {
      ajouterDofus(meta, id, () => 0);
    }
    expect(dofusDebloquables(meta)).toEqual([`dofus_ebene`]);
  });

  it(`une ancienne sauvegarde voit ses Dofus hors ordre mis de côté, puis rendus avec leur jet`, () => {
    const meta = metaVide();
    meta.dofus = [{ id: `dofawa` }, { id: `dofus_des_glaces` }, { id: `dofus_ebene` }];
    const suspendus = remettreDofusEnOrdre(meta);
    expect(suspendus.sort()).toEqual([`dofus_des_glaces`, `dofus_ebene`]);
    expect(meta.dofus.map((d) => d.id)).toEqual([`dofawa`]);
    meta.dofusSuspendus.find((d) => d.id === `dofus_ebene`).jet = 42;
    ajouterDofus(meta, `dofus_ebene`);
    expect(meta.dofus.find((d) => d.id === `dofus_ebene`).jet).toBe(42);
    expect(meta.dofusSuspendus.some((d) => d.id === `dofus_ebene`)).toBe(false);
  });

  it(`une sauvegarde dans l'ordre n'est pas touchée`, () => {
    const meta = metaVide();
    meta.dofus = [{ id: `dofawa` }, { id: `dofus_argente` }];
    expect(remettreDofusEnOrdre(meta)).toEqual([]);
    expect(meta.dofus).toHaveLength(2);
  });

  it(`les Dofus mis de côté survivent au rechargement de la sauvegarde`, () => {
    const stock = {};
    globalThis.localStorage = {
      getItem: (k) => stock[k] ?? null,
      setItem: (k, v) => (stock[k] = v),
      removeItem: (k) => delete stock[k],
    };
    try {
      const meta = chargerMeta();
      meta.dofus = [{ id: `dofus_ebene` }];
      remettreDofusEnOrdre(meta);
      sauverMeta(meta);
      const relue = chargerMeta();
      expect(relue.dofus).toEqual([]);
      expect(relue.dofusSuspendus.map((d) => d.id)).toEqual([`dofus_ebene`]);
    } finally {
      delete globalThis.localStorage;
    }
  });
});
