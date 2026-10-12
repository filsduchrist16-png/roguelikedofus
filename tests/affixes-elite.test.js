// Affixes d'élite : chaque affixe est appliqué par le moteur et renvoyé tel quel pour la pastille.
import { describe, expect, it } from "vitest";
import { AFFIXES_GROUPE } from "../src/jeu/config.js";
import { appliquerAffixesElite, monstresDuCombat } from "../src/jeu/run.js";

describe(`appliquerAffixesElite`, () => {
  for (const affixe of AFFIXES_GROUPE) {
    it(`renvoie l'affixe « ${affixe.nom} » demandé, avec nom et description pour la pastille`, () => {
      const monstres = monstresDuCombat(`abr_1`);
      const res = appliquerAffixesElite(monstres, () => 0.99, [affixe.id]);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(affixe.id);
      expect(res[0].nom).toBeTruthy();
      expect(res[0].desc).toBeTruthy();
    });
  }
  it(`Véloces : +4 d'initiative et +1 PA sur chaque monstre`, () => {
    const avant = monstresDuCombat(`abr_1`);
    const apres = monstresDuCombat(`abr_1`);
    appliquerAffixesElite(apres, () => 0.5, [`veloce`]);
    apres.forEach((m, i) => {
      expect(m.initiative).toBe(avant[i].initiative + 4);
      expect(m.paMax).toBe(avant[i].paMax + 1);
      expect(m.paActuels).toBe(m.paMax);
    });
  });
  it(`Cuirassés : +20 % de PV`, () => {
    const avant = monstresDuCombat(`abr_1`);
    const apres = monstresDuCombat(`abr_1`);
    appliquerAffixesElite(apres, () => 0.5, [`cuirasse`]);
    apres.forEach((m, i) => expect(m.pvMax).toBeGreaterThan(avant[i].pvMax));
  });
  it(`sans affixe fourni (zaap, ancienne sauvegarde) : en tire un au hasard, jamais vide`, () => {
    for (const x of [0, 0.34, 0.67, 0.99]) {
      const res = appliquerAffixesElite(monstresDuCombat(`abr_1`), () => x, undefined);
      expect(AFFIXES_GROUPE.map((a) => a.id)).toContain(res[0].id);
    }
  });
});
