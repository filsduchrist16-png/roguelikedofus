// Songes infinis : logique pure (étages, facteur, affixes, récompenses, score, déblocage, sauvegarde).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AFFIXES_GROUPE, RARETES } from "../src/jeu/config.js";
import { EQUIPEMENTS, MONSTRES } from "../src/data/index.js";
import { BENEDICTIONS } from "../src/jeu/rencontres.js";
import { monstresDuCombat, pvMaxPerso } from "../src/jeu/run.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import { EMPLACEMENTS, emplacementsDuType } from "../src/jeu/emplacements.js";
import {
  CONFIG_SONGES,
  affixesAffiches,
  appliquerRecompense,
  appliquerSonge,
  butinSonges,
  combatsSonges,
  estEtageBoss,
  facteurSonge,
  franchirEtage,
  genererEtage,
  kitDepart,
  menaceCombat,
  nouvelleRunSonges,
  raretesSonge,
  runSongesValide,
  scoreSonges,
  songesDebloques,
  tirerAffixeSonge,
  tirerRecompenses,
} from "../src/jeu/songes.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
globalThis.localStorage ??= stockage();

describe(`Songes : étages`, () => {
  it(`le facteur part de la base et croît à chaque étage`, () => {
    expect(facteurSonge(1)).toBeCloseTo(CONFIG_SONGES.facteurBase);
    for (let etage = 1; etage < 60; etage++) {
      expect(facteurSonge(etage + 1)).toBeGreaterThan(facteurSonge(etage));
    }
  });
  it(`un boss tous les 5 étages, tiré parmi les boss ; sinon un combat des Mondes 4-5`, () => {
    const { normaux, boss } = combatsSonges();
    expect(normaux.length).toBeGreaterThan(20);
    expect(boss.length).toBeGreaterThan(20);
    const rng = rngGraine(7);
    for (let etage = 1; etage <= 30; etage++) {
      const e = genererEtage(etage, rng);
      expect(e.boss).toBe(etage % 5 === 0);
      expect(estEtageBoss(etage)).toBe(e.boss);
      expect(e.boss ? boss : normaux).toContain(e.combatId);
      expect(e.facteur).toBeGreaterThan(0);
    }
  });
  it(`les boss de tous les mondes sont ramenés à la menace d'un boss du Monde 5`, () => {
    const { boss, referenceBoss } = combatsSonges();
    const facile = [...boss].sort((a, b) => menaceCombat(a) - menaceCombat(b))[0];
    const dur = [...boss].sort((a, b) => menaceCombat(b) - menaceCombat(a))[0];
    for (const combatId of [facile, dur]) {
      // rng qui tire ce combat précis
      const indice = boss.indexOf(combatId);
      const e = genererEtage(10, () => (indice + 0.5) / boss.length);
      expect(e.combatId).toBe(combatId);
      const attendu = facteurSonge(10) * CONFIG_SONGES.facteurBoss;
      expect(Math.sqrt((menaceCombat(combatId) * e.facteur ** 2) / referenceBoss)).toBeCloseTo(
        attendu,
        2,
      );
    }
  });
  it(`même graine, mêmes étages`, () => {
    const a = rngGraine(42);
    const b = rngGraine(42);
    for (let etage = 1; etage <= 12; etage++) {
      expect(genererEtage(etage, a)).toEqual(genererEtage(etage, b));
    }
  });
});

describe(`Songes : affixes`, () => {
  it(`d'abord trois affixes différents, puis ils se cumulent`, () => {
    const rng = rngGraine(3);
    const actifs = [];
    for (let k = 0; k < 3; k++) {
      actifs.push(tirerAffixeSonge(actifs, rng));
    }
    expect(new Set(actifs).size).toBe(AFFIXES_GROUPE.length);
    actifs.push(tirerAffixeSonge(actifs, rng));
    const groupes = affixesAffiches(actifs);
    expect(groupes).toHaveLength(3);
    expect(groupes.filter((g) => g.n === 2)).toHaveLength(1);
    expect(groupes.find((g) => g.n === 2).nom).toMatch(/×2$/);
  });
  it(`les affixes actifs s'appliquent tous, et se cumulent`, () => {
    const combatId = combatsSonges().normaux[0];
    const base = monstresDuCombat(combatId);
    const une = monstresDuCombat(combatId);
    const deux = monstresDuCombat(combatId);
    appliquerSonge(une, 1, [`cuirasse`], Math.random);
    appliquerSonge(deux, 1, [`cuirasse`, `cuirasse`, `veloce`], Math.random);
    base.forEach((monstre, i) => {
      expect(une[i].pvMax).toBe(Math.round(monstre.pvMax * 1.2));
      expect(deux[i].pvMax).toBe(Math.round(Math.round(monstre.pvMax * 1.2) * 1.2));
      expect(deux[i].paMax).toBe(monstre.paMax + 1);
    });
  });
  it(`le facteur de l'étage multiplie PV et dégâts`, () => {
    const combatId = combatsSonges().normaux[0];
    const base = monstresDuCombat(combatId);
    const forts = monstresDuCombat(combatId);
    appliquerSonge(forts, 2, [], Math.random);
    expect(forts[0].pvMax).toBe(base[0].pvMax * 2);
  });
  it(`un affixe s'ajoute après chaque étage multiple de 3`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    const rng = rngGraine(2);
    for (let etage = 1; etage <= 9; etage++) {
      franchirEtage(run, rng);
      expect(run.affixesSonge).toHaveLength(Math.floor(etage / 3));
      expect(run.etage).toBe(etage + 1);
    }
  });
});

describe(`Songes : départ et récompenses`, () => {
  it(`kit de départ : un objet commun du Monde 5 par emplacement`, () => {
    const kit = kitDepart(rngGraine(5));
    expect(Object.keys(kit).sort()).toEqual([...EMPLACEMENTS].sort());
    for (const [emplacement, objet] of Object.entries(kit)) {
      expect(objet.rarete).toBe(`commun`);
      expect(butinSonges()).toContain(objet.id);
      expect(emplacementsDuType(EQUIPEMENTS[objet.id].slot)).toContain(emplacement);
    }
  });
  it(`nouvelle tentative : niveau 200, équipée, en pleine forme, mode songes`, () => {
    const run = nouvelleRunSonges([`iop`, `eniripsa`], rngGraine(9), 300);
    expect(run.mode).toBe(`songes`);
    expect(run.etage).toBe(1);
    expect(run.affixesSonge).toEqual([]);
    expect(run.ascension).toBe(0);
    expect(run.idolesDepart).toEqual([]);
    expect(run.kamas).toBe(300);
    for (const perso of run.persos) {
      expect(perso.progression.niveau).toBe(200);
      expect(Object.keys(perso.equipement).length).toBe(EMPLACEMENTS.length);
      expect(perso.pvActuels).toBe(pvMaxPerso(perso));
    }
    expect(runSongesValide(run)).toBe(true);
  });
  it(`trois récompenses de types différents ; la rareté des objets monte avec l'étage`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    const rng = rngGraine(11);
    for (let etage = 1; etage <= 40; etage++) {
      const offre = tirerRecompenses(etage, run, rng);
      expect(offre).toHaveLength(3);
      expect(new Set(offre.map((r) => r.type)).size).toBe(3);
      for (const r of offre) {
        if (r.type === `objet`) {
          expect(raretesSonge(etage)).toContain(r.objet.rarete);
        }
      }
      // palier : la récompense de soin n'est pas proposée (soin complet offert)
      if (etage % 5 === 0) {
        expect(offre.some((r) => r.type === `soin`)).toBe(false);
      }
    }
    expect(raretesSonge(1)).toEqual([`commun`, `rare`]);
    expect(raretesSonge(6)).toEqual([`rare`, `epique`]);
    expect(raretesSonge(50)).toEqual([`epique`, `legendaire`]);
    expect(RARETES.indexOf(raretesSonge(30)[0])).toBeGreaterThan(RARETES.indexOf(`rare`));
  });
  it(`plus d'amélioration quand toutes les bénédictions sont prises et rien n'est forgeable`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    run.benedictions = Object.keys(BENEDICTIONS);
    for (const perso of run.persos) perso.equipement = {};
    const offre = tirerRecompenses(2, run, rngGraine(4));
    expect(offre.map((r) => r.type).sort()).toEqual([`kamas`, `objet`, `soin`]);
  });
  it(`repos : 50 % des PV aux héros debout, les K.O. relevés à 30 %`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    const [a, b] = run.persos;
    a.pvActuels = 1;
    b.pvActuels = 0;
    appliquerRecompense(run, { type: `soin`, pct: 0.5, releve: 0.3 });
    expect(a.pvActuels).toBe(1 + Math.round(pvMaxPerso(a) * 0.5));
    expect(b.pvActuels).toBe(Math.round(pvMaxPerso(b) * 0.3));
  });
  it(`objet, kamas et bénédiction`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    const offre = tirerRecompenses(3, run, rngGraine(8));
    const objet = { type: `objet`, objet: kitDepart(rngGraine(2)).arme };
    appliquerRecompense(run, objet);
    expect(run.inventaire).toContain(objet.objet);
    appliquerRecompense(run, { type: `kamas`, montant: 500 });
    expect(run.kamas).toBe(500);
    appliquerRecompense(run, { type: `amelioration`, benediction: `iop` });
    expect(run.benedictions).toEqual([`iop`]);
    expect(offre).toHaveLength(3);
  });
  it(`palier tous les 5 étages : soin complet, taverne et HDV proposés`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    run.etage = 5;
    run.persos[0].pvActuels = 0;
    run.persos[1].pvActuels = 3;
    const { palier } = franchirEtage(run, rngGraine(3));
    expect(palier).toBe(true);
    expect(run.palierSonge).toEqual({ taverne: false, hdv: false });
    for (const perso of run.persos) expect(perso.pvActuels).toBe(pvMaxPerso(perso));
    expect(run.offreSonge).toHaveLength(3);
  });
});

describe(`Songes : score, record et déblocage`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  it(`score = dernier étage franchi`, () => {
    expect(scoreSonges(1)).toBe(0);
    expect(scoreSonges(11)).toBe(10);
  });
  it(`débloqué après une run du Monde 5 gagnée`, async () => {
    const { chargerMeta, enregistrerRun } = await import(`../src/sauvegarde/meta.js`);
    const { songesDebloques: debloques } = await import(`../src/jeu/songes.js`);
    const meta = chargerMeta();
    expect(debloques(meta)).toBe(false);
    enregistrerRun(meta, true, `t4`);
    expect(debloques(meta)).toBe(false);
    enregistrerRun(meta, true, `t5`);
    expect(debloques(meta)).toBe(true);
    // ancienne méta : seule la difficulté gagnée du Monde 5 est connue
    expect(songesDebloques({ ascension: { t5: 0 } })).toBe(true);
    expect(songesDebloques({ ascension: { t4: 2 } })).toBe(false);
  });
  it(`record dans meta.records.songes, gardé au rechargement`, async () => {
    const { chargerMeta, enregistrerRecord } = await import(`../src/sauvegarde/meta.js`);
    const { recordSonges } = await import(`../src/jeu/songes.js`);
    const meta = chargerMeta();
    expect(recordSonges(meta)).toBe(0);
    expect(enregistrerRecord(meta, `songes`, 12)).toBe(true);
    expect(enregistrerRecord(meta, `songes`, 8)).toBe(false);
    vi.resetModules();
    const { chargerMeta: recharger } = await import(`../src/sauvegarde/meta.js`);
    expect(recordSonges(recharger())).toBe(12);
    expect(recharger().records.t5).toBeUndefined();
  });
});

describe(`Songes : sauvegarde`, () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  const ecrire = (run) =>
    localStorage.setItem(`rld_run_v0`, JSON.stringify({ version: 2, zoneIdx: 0, run }));
  it(`une run de songes valide se recharge, avec ses récompenses en attente`, async () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    run.etage = 7;
    run.affixesSonge = [`enrage`, `veloce`];
    franchirEtage(run, rngGraine(2));
    run.palierSonge = { taverne: true, hdv: false };
    ecrire(run);
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const charge = chargerRun();
    expect(charge.run.mode).toBe(`songes`);
    expect(charge.run.etage).toBe(8);
    expect(charge.run.affixesSonge).toEqual([`enrage`, `veloce`]);
    expect(charge.run.offreSonge).toHaveLength(3);
    expect(charge.run.palierSonge).toEqual({ taverne: true, hdv: false });
    expect(charge.run.persos[0].progression.niveau).toBe(200);
  });
  it.each([
    [`mode inconnu`, { mode: `songe_bidon` }],
    [`étage négatif`, { etage: -3 }],
    [`étage non entier`, { etage: `douze` }],
    [`étage absurde`, { etage: 1e12 }],
    [`affixe inconnu`, { affixesSonge: [`enrage`, `invincible`] }],
    [`affixes absents`, { affixesSonge: undefined }],
  ])(`rejette une run de songes absurde : %s`, async (_, abime) => {
    const run = { ...nouvelleRunSonges([`iop`, `cra`], rngGraine(1)), ...abime };
    ecrire(run);
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    expect(chargerRun()).toBe(null);
  });
  it(`une ancienne sauvegarde sans mode reste une run normale`, async () => {
    ecrire({ trancheId: `t2`, persos: [{ classeId: `iop`, progression: { niveau: 60, xp: 0 } }] });
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const charge = chargerRun();
    expect(charge).not.toBe(null);
    expect(charge.run.mode).toBeUndefined();
    expect(charge.run.etage).toBeUndefined();
    expect(charge.zoneIdx).toBe(0);
  });
  it(`récompenses en attente abîmées : oubliées sans perdre la run`, async () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    run.offreSonge = [
      { type: `piege` },
      { type: `objet`, objet: { id: `inexistant` } },
      { type: `kamas`, montant: `beaucoup` },
    ];
    run.palierSonge = `oui`;
    ecrire(run);
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const charge = chargerRun();
    expect(charge.run.offreSonge).toEqual([{ type: `kamas`, montant: 0 }]);
    expect(charge.run.palierSonge).toBe(null);
  });
});

describe(`Songes : données`, () => {
  it(`les combats tirés existent et leurs monstres aussi`, () => {
    const { normaux, boss } = combatsSonges();
    for (const id of [...normaux, ...boss]) {
      for (const monstre of monstresDuCombat(id)) {
        expect(MONSTRES[monstre.monstreId]).toBeDefined();
      }
    }
  });
});
