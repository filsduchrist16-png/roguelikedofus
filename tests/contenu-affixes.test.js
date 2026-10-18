// Affixes d'élite à effet en combat (1.9.0) : Vampiriques, Explosifs, Protecteurs, Épineux.
import { describe, expect, it } from "vitest";
import { AFFIXES_GROUPE } from "../src/jeu/config.js";
import {
  appliquerAffixesElite,
  combattantsEquipe,
  monstresDuCombat,
  nouvelleRun,
} from "../src/jeu/run.js";
import { infligerDegats } from "../src/combat/effets.js";
import { protegerAllie } from "../src/combat/capacites.js";
import { enLigneAvant } from "../src/combat/stats.js";
import { executerCombat } from "../src/combat/moteur.js";
import { choisirActionIA } from "../src/combat/ia.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import { badgesContenu } from "../src/ui/capacitesBoss.js";
import { appliquerSonge, tirerAffixeSonge } from "../src/jeu/songes.js";

const NOUVEAUX = [`vampirique`, `explosif`, `protecteur`, `epineux`];
const ctx = (cs) => {
  const lignes = [];
  return { rng: () => 0.5, log: (m) => lignes.push(m), lignes, combatants: cs };
};
function combat(affixe) {
  const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
  const heros = combattantsEquipe(run);
  const monstres = monstresDuCombat(`inc_4`);
  appliquerAffixesElite(monstres, () => 0.5, [affixe]);
  const cs = [...heros, ...monstres];
  return { cs, heros, monstres, contexte: ctx(cs) };
}

describe(`nouveaux affixes d'élite`, () => {
  it(`quatre affixes de plus, décrits, avec une icône et une pastille sur chaque monstre`, () => {
    for (const id of NOUVEAUX) {
      const affixe = AFFIXES_GROUPE.find((a) => a.id === id);
      expect(affixe, id).toBeDefined();
      expect(affixe.icone).toBeTruthy();
      expect(affixe.desc.length).toBeGreaterThan(20);
      const { monstres } = combat(id);
      for (const m of monstres) {
        const badge = badgesContenu(m).find((b) => b.texte.includes(affixe.nom));
        expect(badge, `${id} ${m.ref}`).toBeDefined();
        expect(badge.tip).toContain(affixe.desc);
      }
    }
    expect(AFFIXES_GROUPE.length).toBe(7);
  });
  it(`Vampiriques : le monstre récupère 20 % des dégâts qu'il inflige`, () => {
    const { heros, monstres, contexte } = combat(`vampirique`);
    const m = monstres[0];
    m.pvActuels = 10;
    infligerDegats(heros[0], 30, m, contexte);
    expect(m.pvActuels).toBe(16);
    expect(contexte.lignes.some((l) => l.includes(`draine`))).toBe(true);
  });
  it(`Explosifs : en tombant, 12 % de ses PV max à chaque héros de la ligne avant, une seule fois`, () => {
    const { heros, monstres, contexte } = combat(`explosif`);
    const m = monstres[0];
    const devant = heros.filter(enLigneAvant);
    const derriere = heros.filter((h) => !enLigneAvant(h));
    const pv = heros.map((h) => h.pvActuels);
    infligerDegats(m, m.pvMax * 2, heros[0], contexte);
    const degats = Math.round(m.pvMax * 0.12);
    heros.forEach((h, k) =>
      expect(h.pvActuels).toBe(devant.includes(h) ? Math.max(0, pv[k] - degats) : pv[k]),
    );
    expect(derriere.length + devant.length).toBe(heros.length);
    infligerDegats(m, 10, heros[0], contexte);
    expect(contexte.lignes.filter((l) => l.includes(`explose`)).length).toBe(1);
  });
  it(`Protecteurs : bouclier de 8 % sur l'allié le plus blessé`, () => {
    const { cs, monstres, contexte } = combat(`protecteur`);
    const [a, b] = monstres;
    b.pvActuels = Math.round(b.pvMax / 3);
    const protege = protegerAllie(a, cs, contexte);
    expect(protege.ref).toBe(b.ref);
    expect(b.bouclier).toBe(Math.round(b.pvMax * 0.08));
    expect(b.boucliersTemporaires[0].tours).toBe(2);
  });
  it(`Épineux : 15 % des dégâts subis reviennent à l'attaquant`, () => {
    const { heros, monstres, contexte } = combat(`epineux`);
    const iop = heros[0];
    const pv = iop.pvActuels;
    infligerDegats(monstres[0], 40, iop, contexte);
    expect(iop.pvActuels).toBe(pv - 6);
  });
  it(`un combat élite avec chaque nouvel affixe se joue jusqu'au bout`, async () => {
    for (const id of NOUVEAUX) {
      const { cs } = combat(id);
      await executerCombat(cs, {
        rng: rngGraine(id.length),
        controllers: { joueur: choisirActionIA, ennemi: choisirActionIA },
      });
      for (const c of cs) expect(c.pvActuels).toBeGreaterThanOrEqual(0);
    }
  });
  it(`Songes : les nouveaux affixes sont tirés avant qu'un affixe se cumule, et se cumulent ensuite`, () => {
    const actifs = [];
    for (let k = 0; k < AFFIXES_GROUPE.length; k++)
      actifs.push(tirerAffixeSonge(actifs, rngGraine(k)));
    expect(new Set(actifs).size).toBe(AFFIXES_GROUPE.length);
    const monstres = monstresDuCombat(`inc_4`);
    appliquerSonge(monstres, 1, [`vampirique`, `vampirique`], () => 0.5);
    expect(monstres[0].volDeVie).toBeCloseTo(0.4);
    expect(monstres[0].affixesPortes.length).toBe(1);
  });
});

describe(`affixes propres aux Songes`, () => {
  it(`Brumeux et Régénérants : dans la rotation des Songes, jamais sur la carte d'une run`, async () => {
    const { AFFIXES_SONGE } = await import(`../src/jeu/config.js`);
    const { AFFIXES_SONGES, affixeConnu } = await import(`../src/jeu/songes.js`);
    expect(AFFIXES_SONGE.map((a) => a.id)).toEqual([`brumeux`, `regenerant`]);
    for (const a of AFFIXES_SONGE) {
      expect(affixeConnu(a.id)).toBe(true);
      expect(AFFIXES_GROUPE.some((g) => g.id === a.id)).toBe(false);
    }
    const actifs = [];
    for (let k = 0; k < AFFIXES_SONGES.length; k++)
      actifs.push(tirerAffixeSonge(actifs, rngGraine(k)));
    expect(new Set(actifs).size).toBe(AFFIXES_SONGES.length);
    const monstres = monstresDuCombat(`inc_4`);
    appliquerSonge(monstres, 1.5, [`brumeux`, `regenerant`], () => 0.5);
    const m = monstres[0];
    expect(m.esquiveBonus).toBeCloseTo(0.1);
    const hot = m.effets.find((e) => e.stat === `hot`);
    expect(hot.valeur).toBe(Math.round(m.pvMax * 0.04));
    expect(m.affixesPortes.map((a) => a.id)).toEqual([`brumeux`, `regenerant`]);
  });
});
