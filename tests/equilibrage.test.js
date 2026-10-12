import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AJUSTEMENTS_DONJONS,
  AJUSTEMENTS_ZONES,
  COMBATS,
  EQUIPEMENTS,
  MONDES,
  MONSTRES,
  PANOPLIES,
  SECRETS,
  ZONES,
} from "../src/data/index.js";
import { PUISSANCE_PAR_TYPE, RECUPERATION, facteurType } from "../src/jeu/config.js";
import { genererCarte } from "../src/carte/generation.js";
import { numeroZoneObjet } from "../src/jeu/economie.js";
import {
  bonusPanoplie,
  compterPanoplies,
  paliersPanoplie,
  taillePanoplie,
} from "../src/jeu/panoplies.js";
import { tirerRencontre } from "../src/jeu/rencontres.js";
import {
  appliquerPuissanceZone,
  bonusEquipement,
  chanceArchi,
  chanceArchiNouveau,
  emplacementCible,
  emplacementPossible,
  equiperObjet,
  instancierObjet,
  monstresDuCombat,
  nouvelleRun,
  pvMaxPerso,
  puissanceZone,
  recupererApresVictoire,
  tirerArchis,
} from "../src/jeu/run.js";
import { monstresSecrets, recompensesSecret } from "../src/jeu/secret.js";

const rngFixe = (seed = 1) => {
  let a = seed;
  return () => (a = (a * 16807) % 2147483647) / 2147483647;
};
const zone = (id) => ZONES.find((z) => z.id === id);

describe(`panoplies`, () => {
  it(`chaque panoplie a des pièces existantes et des paliers croissants, de 2 pièces à complète`, () => {
    for (const [nom, p] of Object.entries(PANOPLIES)) {
      expect(
        p.pieces.every((id) => EQUIPEMENTS[id]?.panoplie === nom),
        nom,
      ).toBe(true);
      const paliers = paliersPanoplie(nom);
      expect(paliers[0], nom).toBe(2);
      expect(paliers.at(-1), nom).toBe(taillePanoplie(nom));
      for (let k = 1; k < paliers.length; k++) {
        const a = p.paliers[paliers[k - 1]];
        const b = p.paliers[paliers[k]];
        expect(b.adaptatif ?? 0, nom).toBeGreaterThanOrEqual(a.adaptatif ?? 0);
        expect(b.stats?.vitalite ?? 0, nom).toBeGreaterThanOrEqual(a.stats?.vitalite ?? 0);
        // le PA, une fois gagné, reste aux paliers suivants
        if (a.pa) {
          expect(b.pa, nom).toBe(1);
        }
      }
      // jamais de PA avant 3 pièces
      expect(p.paliers[2].pa, nom).toBeUndefined();
    }
  });

  it(`les panoplies tombent dans la tranche de niveaux de leur monde`, () => {
    const tranches = MONDES.map((m) => m.niveaux);
    for (const [nom, p] of Object.entries(PANOPLIES)) {
      const [a, b] = tranches[Math.floor((p.toile - 1) / 12)];
      expect(p.niveau, nom).toBeLessThanOrEqual(b + 12);
      expect(p.niveau, nom).toBeGreaterThanOrEqual(a - 35);
    }
    // quelques familles emblématiques
    const toile = (nom) => PANOPLIES[nom].toile;
    const zoneDe = (nom) => MONDES.flatMap((m) => m.zones)[toile(nom) - 1];
    expect(zoneDe(`Panoplie du Bouftou`)).toBe(`tainela`);
    expect(zoneDe(`Panoplie du Tofu`)).toBe(`tofus`);
    expect(zoneDe(`Panoplie du Minotoror`)).toBe(`labyrinthe_minotoror`);
    expect(zoneDe(`Panoplie du Rat Noir`)).toBe(`egouts_bonta_brakmar`);
    expect(zoneDe(`Panoplie du Comte Harebourg`)).toBe(`donjon_harebourg`);
  });

  it(`les pièces portées donnent le bonus du palier atteint, et les PA sont plafonnés`, () => {
    const nom = `Panoplie du Bouftou`;
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    const iop = run.persos.find((p) => p.classeId === `iop`);
    const sans = bonusEquipement(iop);
    const pieces = PANOPLIES[nom].pieces;
    for (const id of pieces) {
      iop.run = run;
      run.inventaire.push(instancierObjet(id, Object.keys(EQUIPEMENTS[id].tiers)[0]));
      equiperObjet(run.inventaire, iop, run.inventaire.length - 1);
    }
    expect(compterPanoplies(iop)[nom]).toBe(pieces.length);
    const avec = bonusEquipement(iop);
    const complet = bonusPanoplie(nom, pieces.length);
    expect(complet.palier).toBe(pieces.length);
    expect(avec.paBonus - sans.paBonus).toBe(complet.pa ?? 0);
    expect(bonusPanoplie(nom, 1)).toBe(null);
    expect(bonusPanoplie(nom, 2).palier).toBe(2);
    // deux panoplies à PA : +1 PA seulement
    const avecPa = Object.keys(PANOPLIES).filter(
      (n) => !PANOPLIES[n].secret && PANOPLIES[n].paliers[3]?.pa && taillePanoplie(n) === 3,
    );
    const p2 = { classeId: `iop`, equipement: {}, progression: iop.progression };
    const pris = new Set();
    for (const n of avecPa) {
      const slots = PANOPLIES[n].pieces.map((id) => EQUIPEMENTS[id].slot);
      if (slots.some((s) => pris.has(s)) || new Set(slots).size < 3) continue;
      for (const id of PANOPLIES[n].pieces) {
        p2.equipement[EQUIPEMENTS[id].slot] = instancierObjet(id, `epique`);
        pris.add(EQUIPEMENTS[id].slot);
      }
      if (Object.keys(compterPanoplies(p2)).length >= 2) break;
    }
    expect(Object.keys(compterPanoplies(p2)).length).toBeGreaterThanOrEqual(2);
    expect(bonusEquipement(p2).paBonus).toBe(1);
  });

  it(`deux anneaux : le second va dans l'autre emplacement, sauf deux fois le même anneau de panoplie`, () => {
    const run = nouvelleRun([`iop`], 0, `t1`);
    const p = run.persos[0];
    const anneauPano = Object.values(EQUIPEMENTS).find(
      (o) => o.slot === `anneau` && o.panoplie && o.tiers.rare && o.tiers.epique,
    );
    const anneauLibre = Object.values(EQUIPEMENTS).find((o) => o.slot === `anneau` && !o.panoplie);
    run.inventaire.push(instancierObjet(anneauPano.id, `rare`));
    equiperObjet(run.inventaire, p, 0);
    expect(p.equipement.anneau?.id).toBe(anneauPano.id);
    run.inventaire.push(instancierObjet(anneauPano.id, `epique`));
    equiperObjet(run.inventaire, p, 0);
    // le même anneau de panoplie remplace le premier au lieu d'occuper le second emplacement
    expect(p.equipement.anneau2).toBeUndefined();
    expect(p.equipement.anneau.rarete).toBe(`epique`);
    expect(emplacementPossible(p, run.inventaire[0], `anneau2`)).toBe(false);
    run.inventaire.push(instancierObjet(anneauLibre.id, Object.keys(anneauLibre.tiers)[0]));
    equiperObjet(run.inventaire, p, run.inventaire.length - 1);
    expect(p.equipement.anneau2?.id).toBe(anneauLibre.id);
    expect(emplacementCible(p, { id: `inconnu` })).toBeUndefined();
  });
});

describe(`équilibrage`, () => {
  it(`la première zone d'un monde commence par une rangée de tavernes`, () => {
    const carte = genererCarte(rngFixe(3), zone(`incarnam`).pools, [], { premiereZone: true });
    const rangee1 = carte.noeuds.filter((n) => n.ligne === 1);
    expect(rangee1.length).toBeGreaterThan(0);
    expect(rangee1.every((n) => n.type === `taverne`)).toBe(true);
  });

  it(`après une victoire, seuls les héros debout récupèrent des PV`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    const [a, b] = run.persos;
    a.pvActuels = 10;
    b.pvActuels = 0;
    recupererApresVictoire(run);
    expect(a.pvActuels).toBeGreaterThan(10);
    expect(a.pvActuels).toBeLessThanOrEqual(pvMaxPerso(a));
    expect(b.pvActuels).toBe(0);
  });

  it(`l'ajustement de puissance d'une zone multiplie PV et dégâts`, () => {
    const id = Object.keys(AJUSTEMENTS_ZONES)[0];
    const z = zone(id);
    const f = AJUSTEMENTS_ZONES[id];
    const base = monstresDuCombat(z.pools.normales[0]);
    const ajuste = monstresDuCombat(z.pools.normales[0]);
    appliquerPuissanceZone(ajuste, id);
    expect(ajuste[0].pvMax).toBe(Math.round(base[0].pvMax * f));
    for (const v of Object.values(AJUSTEMENTS_ZONES)) {
      expect(v).toBeGreaterThan(0.4);
      expect(v).toBeLessThan(2);
    }
  });

  it(`la puissance par type de combat : élites >= normaux, croissante dans le monde, jamais impossible`, () => {
    for (const type of Object.keys(PUISSANCE_PAR_TYPE)) {
      for (let i = 1; i < 12; i++) {
        expect(facteurType(type, i)).toBeGreaterThanOrEqual(facteurType(type, i - 1) - 1e-9);
      }
    }
    for (let i = 0; i < 12; i++) {
      // les combats durs sont toujours plus dangereux que les combats normaux
      expect(facteurType(`combat_dur`, i)).toBeGreaterThanOrEqual(facteurType(`combat`, i));
    }
    // le facteur de la dernière zone d'un monde dépasse celui de la première (combats durs)
    expect(facteurType(`combat_dur`, 11)).toBeGreaterThan(facteurType(`combat_dur`, 0));
    // aucune zone n'est impossible, ni (en Normal) triviale : facteur total borné pour chaque type
    for (const m of MONDES) {
      for (const zid of m.zones) {
        const i = m.zones.indexOf(zid);
        for (const type of [`combat`, `combat_dur`, `donjon`]) {
          let f = puissanceZone(zid) * facteurType(type, i, m.zones.length);
          if (type === `donjon`) f *= AJUSTEMENTS_DONJONS[zid] ?? 1;
          expect(f, `${zid} ${type}`).toBeGreaterThan(0.3);
          expect(f, `${zid} ${type}`).toBeLessThan(2);
        }
      }
    }
    for (const v of Object.values(AJUSTEMENTS_DONJONS)) {
      expect(v).toBeGreaterThanOrEqual(0.7);
      expect(v).toBeLessThanOrEqual(1.25);
    }
    // aucun monde n'a une puissance moyenne de zone dérisoire
    const moy = MONDES.map(
      (m) => m.zones.reduce((a, z) => a + puissanceZone(z), 0) / m.zones.length,
    );
    expect(Math.min(...moy)).toBeGreaterThan(0.5);
    expect(RECUPERATION.victoire).toBeLessThanOrEqual(0.15);
  });

  it(`le type de combat s'ajoute à la puissance de la zone (PV des monstres)`, () => {
    const id = `tofus`;
    const z = zone(id);
    const base = monstresDuCombat(z.pools.elite[0]);
    const dur = monstresDuCombat(z.pools.elite[0]);
    appliquerPuissanceZone(dur, id, `combat_dur`);
    const f = puissanceZone(id) * facteurType(`combat_dur`, 3);
    expect(dur[0].pvMax).toBe(Math.round(base[0].pvMax * f));
  });
});

describe(`donjons secrets`, () => {
  it(`chaque monde a son donjon secret complet`, () => {
    for (const m of MONDES) {
      const s = SECRETS[m.id];
      expect(s, m.id).toBeTruthy();
      expect(COMBATS[s.combat], s.combat).toBeTruthy();
      for (const { monstre } of COMBATS[s.combat].ennemis) {
        expect(MONSTRES[monstre], monstre).toBeTruthy();
        expect(existsSync(`public${MONSTRES[monstre].img}`), monstre).toBe(true);
      }
      expect(s.bosses.every((b) => MONSTRES[b]?.boss)).toBe(true);
      for (const id of s.butin) {
        expect(EQUIPEMENTS[id], id).toBeTruthy();
        expect(existsSync(`public/assets/items/${id}.png`), id).toBe(true);
        expect(Object.keys(EQUIPEMENTS[id].tiers).sort()).toEqual([`epique`, `legendaire`]);
        // prix et « trouvé en toile » : comme un objet de la 10e zone du monde
        expect(numeroZoneObjet(id)).toBeGreaterThan(1 + MONDES.indexOf(m) * 12);
      }
    }
  });

  it(`le donjon secret est plus fort que le donjon de la zone, et grandit avec elle`, () => {
    for (const m of MONDES) {
      const tot = (l) => l.reduce((a, x) => a + x.pvMax, 0);
      const z1 = zone(m.zones[0]);
      const z12 = zone(m.zones.at(-1));
      const boss1 = tot(
        monstresDuCombat(z1.pools.boss[0]).filter((x) => MONSTRES[x.monstreId].boss),
      );
      const sec1 = monstresSecrets(m.id, z1);
      const sec12 = monstresSecrets(m.id, z12);
      expect(tot(sec1.filter((x) => MONSTRES[x.monstreId].boss)), m.id).toBeGreaterThan(boss1);
      expect(tot(sec12), m.id).toBeGreaterThan(tot(sec1));
    }
    expect(recompensesSecret(30).kamas).toBeGreaterThan(recompensesSecret(1).kamas);
  });

  it(`la rencontre « clé » ne sort pas quand on a déjà une clé`, () => {
    const rng = rngFixe(7);
    const tirages = new Set(Array.from({ length: 400 }, () => tirerRencontre(rng, [`cle`])));
    expect(tirages.has(`cle`)).toBe(false);
    expect(tirages.size).toBe(7);
  });
});

describe(`archimonstres`, () => {
  it(`un archi jamais capturé sort plus souvent, et la jauge de traque monte`, () => {
    const run = nouvelleRun([`iop`], 0, `t1`);
    expect(chanceArchiNouveau(run, 0)).toBeGreaterThan(chanceArchi(run) * 4);
    expect(chanceArchiNouveau(run, 10)).toBeGreaterThan(chanceArchiNouveau(run, 0));
    expect(chanceArchiNouveau(run, 10000)).toBeLessThanOrEqual(0.6);
    const z = zone(`astrub`);
    const mons = monstresDuCombat(z.pools.normales[0]).filter((m) => m.archiNom);
    expect(mons.length).toBeGreaterThan(0);
    // déjà capturés : chance de base (ici nulle) ; inédits : chance « nouveau » (ici certaine)
    const captures = new Set(mons.map((m) => m.monstreId));
    expect(tirerArchis(mons, () => 0.5, 0, captures, 1)).toBe(false);
    expect(mons.some((m) => m.archi)).toBe(false);
    expect(tirerArchis(mons, () => 0.5, 0, new Set(), 1)).toBe(true);
    expect(mons.every((m) => m.archi)).toBe(true);
  });
});
