// Difficultés : ids et ordre stables (sauvegardes), une règle nouvelle par palier, et chaque règle
// appliquée par le moteur.
import { describe, expect, it } from "vitest";
import { MONDES, ZONES } from "../src/data/index.js";
import { AFFIXES_GROUPE, DIFFICULTES, FURIE_BOSS, RECUPERATION } from "../src/jeu/config.js";
import {
  appliquerAffixesCombat,
  appliquerDifficulteMonstres,
  assurerAffixePermanent,
  degatsDifficulte,
  effetsDifficulte,
  especesNormalesZone,
  monstresDuCombat,
  multiplicateurKamas,
  nouvelleRun,
  partDifficulte,
  pvMaxPerso,
  recupererApresVictoire,
} from "../src/jeu/run.js";

const zoneDuMonde1 = (indice) => ZONES.find((z) => z.id === MONDES[0].zones[indice]);
// un combat normal de la zone avec une place libre en première ligne
const combatAvecPlace = (zone) =>
  zone.pools.normales.find((id) => monstresDuCombat(id).filter((m) => m.position < 4).length < 4);

describe(`difficultés`, () => {
  it(`garde les ids et l'ordre enregistrés dans les sauvegardes`, () => {
    expect(DIFFICULTES.map((d) => d.id)).toEqual([
      `normal`,
      `difficile`,
      `extreme`,
      `cauchemar`,
      `ultime`,
    ]);
  });

  it(`chaque palier au-delà de Normal ajoute au moins une règle nouvelle et ne baisse rien`, () => {
    for (let k = 1; k < DIFFICULTES.length; k++) {
      const avant = DIFFICULTES[k - 1].effets;
      const apres = DIFFICULTES[k].effets;
      const nouvelles = Object.keys(apres).filter((cle) => !(cle in avant));
      expect(nouvelles.length, DIFFICULTES[k].id).toBeGreaterThan(0);
      expect(apres.degatsMult ?? 1).toBeGreaterThanOrEqual(avant.degatsMult ?? 1);
      expect(apres.pvMult ?? 1).toBeGreaterThanOrEqual(avant.pvMult ?? 1);
      expect(DIFFICULTES[k].desc.length).toBeGreaterThan(20);
    }
  });

  it(`renfort : pas dans la première zone d'un monde, dès la zone 2`, () => {
    const effets = effetsDifficulte(1);
    for (const [indice, attendu] of [
      [0, 0],
      [1, 1],
    ]) {
      const zone = zoneDuMonde1(indice);
      const monstres = monstresDuCombat(combatAvecPlace(zone));
      const nb = monstres.length;
      appliquerDifficulteMonstres(monstres, effets, {
        type: `combat`,
        zoneId: zone.id,
        especesZone: especesNormalesZone(zone),
        rng: () => 0,
      });
      expect(monstres.length - nb).toBe(attendu);
    }
  });

  it(`Ultime : un monstre de plus en ligne arrière`, () => {
    const zone = zoneDuMonde1(2);
    const monstres = monstresDuCombat(combatAvecPlace(zone));
    const arriere = monstres.filter((m) => m.position >= 4).length;
    appliquerDifficulteMonstres(monstres, effetsDifficulte(4), {
      type: `combat`,
      zoneId: zone.id,
      especesZone: especesNormalesZone(zone),
      rng: () => 0,
    });
    expect(monstres.filter((m) => m.position >= 4).length).toBe(arriere + 1);
  });

  it(`élites : un affixe jusqu'en Difficile, deux distincts dès Extrême`, () => {
    const normal = appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0.5, {
      type: `combat_dur`,
      effets: effetsDifficulte(0),
      eliteModifs: [`cuirasse`],
    });
    expect(normal.map((a) => a.id)).toEqual([`cuirasse`]);
    const difficile = appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0.5, {
      type: `combat_dur`,
      effets: effetsDifficulte(2),
      eliteModifs: [`cuirasse`],
    });
    expect(difficile).toHaveLength(2);
    expect(difficile[0].id).toBe(`cuirasse`);
    expect(difficile[1].id).not.toBe(`cuirasse`);
  });

  it(`dès Difficile, un combat normal peut recevoir un affixe, jamais en Normal`, () => {
    const options = (asc) => ({ type: `combat`, effets: effetsDifficulte(asc) });
    expect(appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0, options(0))).toHaveLength(0);
    expect(appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0, options(1))).toHaveLength(1);
    expect(appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0.99, options(3))).toHaveLength(
      0,
    );
  });

  it(`Ultime : affixe permanent tiré une fois, appliqué à tous les combats et affiché`, () => {
    const run = nouvelleRun([`iop`, `cra`], 4, `t1`);
    const affixe = assurerAffixePermanent(run, () => 0.4);
    expect(AFFIXES_GROUPE.map((a) => a.id)).toContain(run.affixePermanent);
    expect(assurerAffixePermanent(run, () => 0.99).id).toBe(affixe.id);
    const appliques = appliquerAffixesCombat(monstresDuCombat(`abr_1`), () => 0.99, {
      type: `donjon`,
      effets: effetsDifficulte(4),
      affixePermanent: affixe.id,
    });
    expect(appliques).toHaveLength(1);
    expect(appliques[0].permanent).toBe(true);
    expect(appliques[0].nom).toContain(affixe.nom);
    // pas d'affixe permanent hors Ultime (ni pour une run Cauchemar)
    expect(assurerAffixePermanent(nouvelleRun([`iop`, `cra`], 3, `t1`))).toBeUndefined();
  });

  it(`furie : 50 % en Normal, 60 % dès Extrême, bouclier en Cauchemar`, () => {
    const seuil = (asc) => {
      const monstres = monstresDuCombat(zoneDuMonde1(0).pools.boss[0]);
      appliquerDifficulteMonstres(monstres, effetsDifficulte(asc), {
        type: `donjon`,
        rng: () => 0,
      });
      return monstres.find((m) => m.furie).furie;
    };
    expect(seuil(0)).toEqual(FURIE_BOSS);
    expect(seuil(2).seuil).toBe(0.6);
    expect(seuil(2).bouclierPct).toBeUndefined();
    expect(seuil(3).bouclierPct).toBeGreaterThan(0);
  });

  it(`Ultime : aucun soin après une victoire ; Normal : la récupération habituelle`, () => {
    for (const [asc, pct] of [
      [0, RECUPERATION.victoire],
      [4, 0],
    ]) {
      const run = nouvelleRun([`iop`, `cra`], asc, `t1`);
      const perso = run.persos[0];
      perso.pvActuels = Math.round(pvMaxPerso(perso) / 2);
      const avant = perso.pvActuels;
      recupererApresVictoire(run);
      expect(perso.pvActuels - avant).toBe(Math.round(pvMaxPerso(perso) * pct));
    }
  });

  it(`moins de kamas dès Extrême`, () => {
    const kamas = (asc) => multiplicateurKamas(nouvelleRun([`iop`, `cra`], asc, `t1`));
    expect(kamas(2)).toBeCloseTo(kamas(0) * 0.75);
  });
});

describe(`montée au fil des zones`, () => {
  it(`le bonus de difficulté grandit de la première à la dernière zone du monde`, () => {
    const effets = effetsDifficulte(1);
    const zones = MONDES[0].zones;
    const premiere = degatsDifficulte(effets, zones[0]);
    const derniere = degatsDifficulte(effets, zones.at(-1));
    expect(premiere).toBeCloseTo(1 + (effets.degatsMult - 1) * effets.rampe);
    expect(derniere).toBeCloseTo(effets.degatsMult);
    expect(partDifficulte(effets, zones[5])).toBeGreaterThan(partDifficulte(effets, zones[4]));
    // zone inconnue (donjon secret) : la totalité ; Normal : aucun bonus
    expect(degatsDifficulte(effets, undefined)).toBeCloseTo(effets.degatsMult);
    expect(degatsDifficulte(effetsDifficulte(0), zones[3])).toBe(1);
  });
});
