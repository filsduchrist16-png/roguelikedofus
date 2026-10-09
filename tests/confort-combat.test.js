// Confort de combat : raison d'un sort indisponible, badges d'effets chiffrés.
import { describe, expect, it } from "vitest";
import { SORTS } from "../src/data/index.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun } from "../src/jeu/run.js";
import { coutPA, raisonIndisponible } from "../src/combat/stats.js";
import { executerCombat } from "../src/combat/moteur.js";
import { badgesEffets } from "../src/ui/combat.js";

function combat(classes = [`iop`, `cra`]) {
  const run = nouvelleRun(classes, 0, `t1`);
  const heros = combattantsEquipe(run);
  const monstres = monstresDuCombat(`abr_1`);
  const cs = [...heros, ...monstres];
  for (const h of heros) {
    h.toursJoues = 2;
  }
  return { cs, heros, monstres };
}
const sortAvec = (cle) => Object.values(SORTS).find((s) => s[cle]);

describe(`raisonIndisponible`, () => {
  it(`renvoie null pour un sort jouable`, () => {
    const { cs, heros } = combat();
    const iop = heros[0];
    iop.paActuels = 20;
    expect(raisonIndisponible(iop, SORTS[iop.sorts[0]], cs)).toBe(null);
  });
  it(`signale le manque de PA, puis la recharge`, () => {
    const { cs, heros } = combat();
    const iop = heros[0];
    const s = SORTS[iop.sorts[0]];
    iop.paActuels = 0;
    expect(raisonIndisponible(iop, s, cs)).toBe(`PA : 0/${coutPA(s, iop)}`);
    iop.paActuels = 20;
    iop.cooldowns[s.id] = 2;
    expect(raisonIndisponible(iop, s, cs)).toBe(`Recharge : 2 t`);
  });
  it(`explique le premier tour, la limite par tour et la rage`, () => {
    const { cs, heros } = combat();
    const iop = heros[0];
    iop.paActuels = 20;
    const premier = sortAvec(`pasPremierTour`);
    iop.toursJoues = 1;
    expect(raisonIndisponible(iop, premier, cs)).toBe(`Pas au 1er tour`);
    iop.toursJoues = 2;
    const limite = sortAvec(`maxParTour`);
    iop.lancersCeTour = { [limite.id]: limite.maxParTour };
    expect(raisonIndisponible(iop, limite, cs)).toBe(
      `Déjà lancé ce tour (${limite.maxParTour}/${limite.maxParTour})`,
    );
    const rage = sortAvec(`consommeRage`);
    if (rage) {
      iop.rage = 0;
      expect(raisonIndisponible(iop, rage, cs)).toBe(`Il faut 1 Rage`);
    }
  });
  it(`dit « Aucune cible » quand tous les ennemis sont tombés`, () => {
    const { cs, heros, monstres } = combat();
    const iop = heros[0];
    iop.paActuels = 20;
    for (const m of monstres) {
      m.pvActuels = 0;
    }
    const s = iop.sorts.map((id) => SORTS[id]).find((x) => x.cible === `ennemi_ligne`);
    expect(raisonIndisponible(iop, s, cs)).toBe(`Aucune cible`);
  });
});

describe(`badges d'effets`, () => {
  const base = (effets, extra = {}) => ({ effets, ...extra });
  it(`cumule les poisons et affiche dégâts par tour et durée`, () => {
    const b = badgesEffets(
      base([
        { stat: `poison`, valeur: 5, toursRestants: 2 },
        { stat: `poison`, valeur: 7, toursRestants: 3 },
      ]),
    );
    expect(b).toHaveLength(1);
    expect(b[0].texte).toBe(`☠ poison 12/t · 3 t`);
    expect(b[0].tip).toMatch(/12 PV/);
  });
  it(`libelle les effets chiffrés, permanents sans durée`, () => {
    const textes = badgesEffets(
      base(
        [
          { stat: `degatsInfliges`, valeur: 0.15, toursRestants: 2 },
          { stat: `friction`, valeur: 1, toursRestants: 2 },
          { stat: `reductionDegats`, valeur: 0.1, toursRestants: 1 },
          { stat: `force`, valeur: 15, toursRestants: 99 },
          { stat: `force`, valeur: 15, toursRestants: 99 },
          { stat: `resAll`, valeur: 0.15, toursRestants: 99, source: `etat` },
        ],
        { armure: 30, boucliersTemporaires: [{ montant: 40, tours: 2 }] },
      ),
    ).map((x) => x.texte);
    expect(textes).toContain(`⚔ +15 % dgts · 2 t`);
    expect(textes).toContain(`🚫 soins bloqués · 2 t`);
    expect(textes).toContain(`🛡 −10 % subis · 1 t`);
    expect(textes).toContain(`💪 +30 Force`);
    expect(textes).toContain(`🛡 bouclier 40 · 2 t`);
    expect(textes).toContain(`🪨 armure 30`);
    // les effets d'un état de classe sont portés par le badge de l'état
    expect(textes.some((t) => t.includes(`rés.`))).toBe(false);
  });
});

describe(`journal du moteur : rondes`, () => {
  it(`signale chaque ronde et le tour d'un combattant assommé`, async () => {
    const { cs, monstres } = combat();
    const logs = [];
    let rondes = 0;
    await executerCombat(cs, {
      rng: () => 0.5,
      log: (msg, meta) => logs.push({ msg, meta }),
      controllers: { joueur: () => null, ennemi: () => null },
      onEvenement: (ev) => {
        if (ev.type !== `ronde`) {
          return;
        }
        rondes++;
        if (rondes === 2) {
          // tout le monde passe son tour de la ronde 2
          for (const c of cs) {
            c.effets.push({ stat: `assome`, valeur: 1, duree: 1 });
          }
        }
        if (rondes === 3) {
          for (const m of monstres) {
            m.pvActuels = 0;
          }
        }
      },
    });
    expect(logs.filter((l) => l.meta?.ronde).length).toBe(rondes);
    const assommes = logs.filter((l) => l.msg.includes(`est assommé et passe son tour`));
    expect(assommes.length).toBeGreaterThan(0);
    expect(assommes.every((l) => l.meta?.tour)).toBe(true);
  });
});
