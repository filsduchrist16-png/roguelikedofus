import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AJUSTEMENTS_ZONES,
  COMBATS,
  EQUIPEMENTS,
  MONDES,
  MONSTRES,
  PANOPLIES,
  SECRETS,
  ZONES,
} from "../src/data/index.js";
import { genererCarte } from "../src/carte/generation.js";
import { numeroZoneObjet } from "../src/jeu/economie.js";
import { bonusPanoplie, paliersPanoplie, taillePanoplie } from "../src/jeu/panoplies.js";
import { tirerRencontre } from "../src/jeu/rencontres.js";
import {
  appliquerPuissanceZone,
  bonusEquipement,
  instancierObjet,
  monstresDuCombat,
  nouvelleRun,
  pvMaxPerso,
  recupererApresVictoire,
} from "../src/jeu/run.js";
import { monstresSecrets, recompensesSecret } from "../src/jeu/secret.js";

const rngFixe = (seed = 1) => {
  let a = seed;
  return () => (a = (a * 16807) % 2147483647) / 2147483647;
};
const zone = (id) => ZONES.find((z) => z.id === id);

describe(`panoplies`, () => {
  it(`chaque panoplie a des pièces existantes et des paliers croissants`, () => {
    for (const [nom, p] of Object.entries(PANOPLIES)) {
      expect(
        p.pieces.every((id) => EQUIPEMENTS[id]?.panoplie === nom),
        nom,
      ).toBe(true);
      const paliers = paliersPanoplie(nom);
      expect(paliers[0], nom).toBe(2);
      expect(paliers.at(-1), nom).toBe(Math.min(4, taillePanoplie(nom)));
      for (let k = 1; k < paliers.length; k++) {
        const a = p.paliers[paliers[k - 1]];
        const b = p.paliers[paliers[k]];
        expect(b.adaptatif, nom).toBeGreaterThanOrEqual(a.adaptatif);
        expect(b.stats.vitalite, nom).toBeGreaterThanOrEqual(a.stats.vitalite);
      }
      // +1 PA seulement avec 4 pièces
      expect(!!p.paliers[4]?.pa, nom).toBe(taillePanoplie(nom) >= 4);
    }
  });

  it(`les pièces portées donnent le bonus du palier atteint`, () => {
    const nom = `Panoplie du Bouftou`;
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    const iop = run.persos.find((p) => p.classeId === `iop`);
    const sans = bonusEquipement(iop);
    const pieces = PANOPLIES[nom].pieces;
    for (let k = 0; k < pieces.length; k++) {
      const id = pieces[k];
      iop.equipement[EQUIPEMENTS[id].slot] = instancierObjet(
        id,
        Object.keys(EQUIPEMENTS[id].tiers)[0],
      );
    }
    const avec = bonusEquipement(iop);
    expect(bonusPanoplie(nom, 4).pa).toBe(1);
    expect(avec.paBonus - sans.paBonus).toBe(1);
    expect(bonusPanoplie(nom, 1)).toBe(null);
    expect(bonusPanoplie(nom, 2).palier).toBe(2);
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
    expect(tirages.size).toBe(5);
  });
});
