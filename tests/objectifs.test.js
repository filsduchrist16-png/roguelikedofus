import { describe, expect, it } from "vitest";
import { MONSTRES, RELIQUES, SUCCES } from "../src/data/index.js";
import { objectifsDuCombat } from "../src/jeu/objectifs.js";
import { indiceQuete, lieuxMonstre } from "../src/jeu/obtention.js";

const base = {
  quetes: { faites: [] },
  combatId: `x`,
  noeud: `combat`,
  classes: [`iop`],
  ascension: 0,
  archis: [],
  reliques: [],
};
const ennemi = (monstreId, extra = {}) => ({ camp: `ennemi`, monstreId, ...extra });

describe(`objectifs de combat`, () => {
  it(`signale une quête de boss quand le boss est là`, () => {
    const o = objectifsDuCombat({ ...base, noeud: `donjon`, combattants: [ennemi(`corruption`)] });
    expect(
      o.some((x) => /Corruption/.test(x.quete) && /aucun héros ne doit tomber/.test(x.consigne)),
    ).toBe(true);
  });
  it(`ne signale pas une quête déjà faite`, () => {
    const faites = Object.values(SUCCES)
      .flatMap((s) => s.quetes)
      .filter((q) => q.critere.boss === `corruption` && q.critere.type === `vaincre`)
      .map((q) => q.id);
    const o = objectifsDuCombat({
      ...base,
      quetes: { faites },
      combattants: [ennemi(`corruption`)],
    });
    expect(o.some((x) => /Corruption/.test(x.quete) && !/^Relique/.test(x.quete))).toBe(false);
  });
  it(`signale les reliques en donjon et les archimonstres`, () => {
    const boss = Object.keys(RELIQUES).find((id) => MONSTRES[id]);
    const archi = Object.keys(MONSTRES).find((id) => MONSTRES[id].archiNom);
    const o = objectifsDuCombat({
      ...base,
      noeud: `donjon`,
      chanceRelique: 0.05,
      combattants: [ennemi(boss), ennemi(archi, { archi: true })],
    });
    expect(o.some((x) => x.quete.startsWith(`Relique`) && x.consigne.includes(`5 %`))).toBe(true);
    expect(o.some((x) => x.quete.includes(MONSTRES[archi].archiNom))).toBe(true);
  });
  it(`les défis Duo ne sortent qu'avec 2 héros au plus`, () => {
    const c = [ennemi(`roi_imagami`)];
    const trois = objectifsDuCombat({
      ...base,
      noeud: `donjon`,
      classes: [`iop`, `cra`, `feca`],
      combattants: c,
    });
    const deux = objectifsDuCombat({
      ...base,
      noeud: `donjon`,
      classes: [`iop`, `cra`],
      combattants: c,
    });
    expect(trois.some((x) => /Main dans la main/.test(x.quete))).toBe(false);
    expect(deux.some((x) => /Main dans la main/.test(x.quete))).toBe(true);
  });
});

describe(`indices de quêtes`, () => {
  it(`chaque quête a un indice et chaque boss demandé a un lieu`, () => {
    for (const s of Object.values(SUCCES)) {
      for (const q of s.quetes) {
        expect(indiceQuete(q), q.id).not.toBe(``);
        if (q.critere.boss) {
          expect(lieuxMonstre(q.critere.boss).length, q.id).toBeGreaterThan(0);
        }
      }
    }
  });
});
