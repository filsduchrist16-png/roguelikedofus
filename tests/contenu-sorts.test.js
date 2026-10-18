// Sorts avancés des classes (1.9.0) : deux par classe, appris pendant la run (nouveau sort après un
// combat, camp de repos, Songes). Données, effets dans le moteur, apprentissage et sauvegarde.
import { describe, expect, it } from "vitest";
import { CLASSES, SORTS } from "../src/data/index.js";
import {
  combattantsEquipe,
  creerCombattantPerso,
  monstresDuCombat,
  nouvelleRun,
  sortsAppris,
} from "../src/jeu/run.js";
import { lancerSort } from "../src/combat/sorts.js";
import { ciblesValides, enLigneAvant } from "../src/combat/stats.js";
import { executerCombat } from "../src/combat/moteur.js";
import { choisirActionIA } from "../src/combat/ia.js";
import { DOSSIER_ICONE_SORT } from "../src/jeu/config.js";
import {
  CONFIG_RECOMPENSES,
  ameliorationsCandidates,
  appliquerChoix,
  assainirChoix,
  assainirRecompensesRun,
  decrireChoix,
  sortsAApprendre,
  tirerApprentissage,
  tirerOffreCombat,
} from "../src/jeu/recompensesRun.js";
import { optionsCamp } from "../src/jeu/cases.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import { nouvelleRunSonges, tirerRecompenses } from "../src/jeu/songes.js";
import { iconeEmojiSort } from "../src/ui/iconesSorts.js";

const AVANCES = Object.values(CLASSES).flatMap((classe) =>
  classe.sortsAvances.map((id) => [classe.id, id]),
);
// rng haut : jamais d'esquive ni de critique, aucun effet « au hasard » (retrait de PA…)
const ctxTest = (cs) => ({
  rng: () => 0.99,
  log: () => {},
  playerDamageBonus: 1,
  enemyDamageBonus: 1,
  combatants: cs,
});
function preparer(classeId) {
  const autre = classeId === `iop` ? `cra` : `iop`;
  const run = nouvelleRun([classeId, autre], 0, `t1`);
  const lanceurPerso = run.persos.find((perso) => perso.classeId === classeId);
  lanceurPerso.sortsAppris = [...CLASSES[classeId].sortsAvances];
  const heros = combattantsEquipe(run);
  // deux monstres en ligne avant, un en ligne arrière
  const monstres = monstresDuCombat(`inc_4`);
  monstres.forEach((monstre, indice) => {
    monstre.position = [0, 1, 4][indice];
    monstre.pvMax = monstre.pvBase = monstre.pvActuels = 2000;
    monstre.resistances = { terre: 0, feu: 0, eau: 0, air: 0 };
  });
  for (const allie of heros) {
    allie.pvActuels = Math.round(allie.pvMax / 2);
  }
  const cs = [...heros, ...monstres];
  return { cs, heros, monstres, lanceur: heros.find((h) => h.ref === `j_${classeId}`) };
}

describe(`sorts avancés : données`, () => {
  it(`chaque classe a deux sorts avancés, distincts de ses sorts de base, nommés, décrits, avec un emoji`, () => {
    expect(AVANCES.length).toBe(Object.keys(CLASSES).length * 2);
    const vus = new Set();
    for (const [classeId, id] of AVANCES) {
      const sort = SORTS[id];
      expect(sort, id).toBeDefined();
      expect(sort.id).toBe(id);
      expect(CLASSES[classeId].sorts).not.toContain(id);
      expect(vus.has(id), `${id} en double`).toBe(false);
      vus.add(id);
      expect(sort.nom.length).toBeGreaterThan(2);
      expect(sort.desc.length).toBeGreaterThan(20);
      expect(sort.emoji, id).toBeTruthy();
      expect(sort.coutPA).toBeGreaterThanOrEqual(1);
      expect(sort.coutPA).toBeLessThanOrEqual(6);
      expect(sort.baseMin).toBeLessThanOrEqual(sort.baseMax);
      // pas d'image : l'icône est l'emoji dessiné en SVG
      expect(iconeEmojiSort(id)).toMatch(/^data:image\/svg\+xml,/);
      expect(DOSSIER_ICONE_SORT[id]).not.toBe(classeId);
    }
    // un sort de base garde son image
    expect(iconeEmojiSort(`fleche_punitive`)).toBeNull();
  });
});

describe(`sorts avancés : effets dans le moteur`, () => {
  for (const [classeId, id] of AVANCES) {
    it(`${CLASSES[classeId].nom} : ${SORTS[id].nom}`, () => {
      const { cs, heros, monstres, lanceur } = preparer(classeId);
      expect(lanceur.sorts).toContain(id);
      const sort = SORTS[id];
      lanceur.paActuels = 20;
      const cibles = ciblesValides(lanceur, sort, cs);
      expect(cibles.length, `${id} sans cible`).toBeGreaterThan(0);
      // cible : un ennemi de la ligne avant, ou l'allié le plus blessé, ou soi
      const cible =
        cibles.find((c) => c.camp === `ennemi` && enLigneAvant(c)) ??
        cibles.find((c) => c.camp === `joueur` && c.ref !== lanceur.ref) ??
        cibles[0];
      // un sort qui vise « n'importe quel ennemi » atteint la ligne arrière
      if (sort.cible === `ennemi_tous`) {
        const arriere = monstres.find((x) => !enLigneAvant(x));
        expect(
          cibles.some((c) => c.ref === arriere.ref),
          `${id} : ligne arrière`,
        ).toBe(true);
      }
      const avant = structuredClone(cs);
      const pv = (c) => avant.find((x) => x.ref === c.ref).pvActuels;
      lancerSort(lanceur, sort, cible.ref, cs, ctxTest(cs));
      if (sort.type === `degats` && sort.baseMax > 0) {
        expect(cible.pvActuels, `${id} : dégâts`).toBeLessThan(pv(cible));
        if (sort.zoneLigne) {
          for (const m of monstres.filter((x) => enLigneAvant(x) === enLigneAvant(cible))) {
            expect(m.pvActuels, `${id} : zone`).toBeLessThan(pv(m));
          }
          const autreLigne = monstres.find((x) => enLigneAvant(x) !== enLigneAvant(cible));
          expect(autreLigne.pvActuels, `${id} : l'autre ligne`).toBe(pv(autreLigne));
        }
        if (sort.ratioLigne) {
          const voisin = monstres.find((x) => x !== cible && enLigneAvant(x));
          expect(voisin.pvActuels, `${id} : éclaboussure`).toBeLessThan(pv(voisin));
        }
      }
      if (sort.poisonSiPortails) {
        expect(
          cible.effets.some((e) => e.stat === `poison` && e.valeur > 0),
          `${id} : poison`,
        ).toBe(true);
      }
      if (sort.effet && sort.type === `degats`) {
        expect(
          cible.effets.some((e) => e.stat === sort.effet.stat),
          `${id} : effet`,
        ).toBe(true);
      }
      if (sort.effet && sort.type === `buff`) {
        const porteurs = sort.cible === `allie_tous` ? heros : [cible];
        for (const h of porteurs) {
          expect(
            h.effets.some((e) => e.stat === sort.effet.stat),
            `${id} : buff ${h.ref}`,
          ).toBe(true);
        }
      }
      if (sort.hotPct) {
        expect(
          cible.effets.some((e) => e.stat === `hot`),
          `${id} : régénération`,
        ).toBe(true);
      }
      if (sort.type === `soin`) {
        expect(cible.pvActuels, `${id} : soin`).toBeGreaterThan(pv(cible));
      }
      if (sort.bouclierPortee || sort.bouclierRatioDegats) {
        expect(
          heros.some((h) => h.bouclier > 0),
          `${id} : bouclier`,
        ).toBe(true);
      }
      if (sort.vampirismeRatio) {
        expect(lanceur.pvActuels, `${id} : vol de vie`).toBeGreaterThan(pv(lanceur));
      }
      if (sort.deplaceCible === `arriere`) {
        expect(enLigneAvant(cible), `${id} : repoussé`).toBe(false);
      }
      if (sort.marqueElement) {
        expect(cible.marqueElement, `${id} : marque`).toBe(sort.marqueElement);
      }
    });
  }

  it(`un combat complet avec tous les sorts avancés appris se termine sans erreur`, async () => {
    for (const classeId of Object.keys(CLASSES)) {
      const { cs } = preparer(classeId);
      let rng = rngGraine(classeId.length * 7);
      await executerCombat(cs, {
        rng,
        controllers: { joueur: choisirActionIA, ennemi: choisirActionIA },
      });
      for (const c of cs) {
        expect(Number.isFinite(c.pvActuels)).toBe(true);
        expect(c.pvActuels).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe(`sorts avancés : apprentissage pendant la run`, () => {
  it(`un héros apprend ses deux sorts avancés, pas plus, et les garde dans la barre de sorts`, () => {
    const run = nouvelleRun([`cra`, `iop`], 0, `t1`);
    const cra = run.persos.find((p) => p.classeId === `cra`);
    expect(sortsAApprendre(cra)).toEqual(CLASSES.cra.sortsAvances);
    for (const sort of CLASSES.cra.sortsAvances) {
      expect(appliquerChoix(run, { type: `apprendre`, heros: `cra`, sort })).toMatch(/apprend/);
    }
    appliquerChoix(run, { type: `apprendre`, heros: `cra`, sort: CLASSES.cra.sortsAvances[0] });
    expect(sortsAppris(cra)).toEqual(CLASSES.cra.sortsAvances);
    expect(sortsAApprendre(cra)).toEqual([]);
    const combattant = creerCombattantPerso(cra);
    expect(combattant.sorts).toEqual([...CLASSES.cra.sorts, ...CLASSES.cra.sortsAvances]);
    // barre mobile : arme + 8 sorts au plus (touches 1 à 9)
    expect(combattant.sorts.length + 1).toBeLessThanOrEqual(9);
    // un sort d'une autre classe ne s'apprend pas
    expect(appliquerChoix(run, { type: `apprendre`, heros: `iop`, sort: `rekop` })).toBe(``);
    // les sorts appris peuvent recevoir des améliorations
    const candidates = ameliorationsCandidates(run);
    expect(candidates.some((c) => c.sort === `fleche_explosive`)).toBe(true);
  });

  it(`la 3e carte d'une offre peut être un nouveau sort, décrit lisiblement`, () => {
    const run = nouvelleRun([`cra`, `iop`], 0, `t1`);
    let trouve = null;
    for (let graine = 1; graine < 200 && !trouve; graine++) {
      const offre = tirerOffreCombat(run, { elite: true, rng: rngGraine(graine) });
      trouve = offre.choix.find((c) => c.type === `apprendre`);
    }
    expect(trouve).toBeTruthy();
    expect(CLASSES[trouve.heros].sortsAvances).toContain(trouve.sort);
    const description = decrireChoix(trouve, run);
    expect(description.titre).toMatch(/^Nouveau sort : /);
    expect(description.icone).toBe(SORTS[trouve.sort].emoji);
    expect(description.effet).toContain(SORTS[trouve.sort].desc);
    expect(CONFIG_RECOMPENSES.chanceNouveauSort.elite).toBeGreaterThan(
      CONFIG_RECOMPENSES.chanceNouveauSort.normal,
    );
    // plus rien à apprendre : plus de carte « nouveau sort »
    for (const perso of run.persos) perso.sortsAppris = [...CLASSES[perso.classeId].sortsAvances];
    expect(tirerApprentissage(run, rngGraine(1))).toBeNull();
    for (let graine = 1; graine < 50; graine++) {
      const offre = tirerOffreCombat(run, { elite: true, rng: rngGraine(graine) });
      expect(offre.choix.some((c) => c.type === `apprendre`)).toBe(false);
    }
  });

  it(`le camp de repos propose d'étudier un nouveau sort, les Songes aussi`, () => {
    const run = nouvelleRun([`sadida`, `xelor`], 0, `t1`);
    const { apprendre } = optionsCamp(run, rngGraine(3));
    expect(apprendre.type).toBe(`apprendre`);
    const songe = nouvelleRunSonges([`iop`, `cra`], rngGraine(2));
    let vu = false;
    for (let graine = 1; graine < 60 && !vu; graine++) {
      vu = tirerRecompenses(2, songe, rngGraine(graine)).some((r) => r.type === `apprendre`);
    }
    expect(vu).toBe(true);
  });

  it(`sauvegarde : sans sortsAppris tout va bien, un sort inconnu ou d'une autre classe est retiré`, () => {
    const run = nouvelleRun([`cra`, `iop`], 0, `t1`);
    // ancienne run : aucun champ
    assainirRecompensesRun(run);
    expect(run.persos.every((p) => p.sortsAppris === undefined)).toBe(true);
    const cra = run.persos.find((p) => p.classeId === `cra`);
    const iop = run.persos.find((p) => p.classeId === `iop`);
    cra.sortsAppris = [`fleche_explosive`, `inconnu`, `rekop`, `fleche_explosive`];
    iop.sortsAppris = `abîmé`;
    assainirRecompensesRun(run);
    expect(cra.sortsAppris).toEqual([`fleche_explosive`]);
    expect(iop.sortsAppris).toBeUndefined();
    expect(assainirChoix({ type: `apprendre`, heros: `cra`, sort: `fleche_explosive` })).toEqual({
      type: `apprendre`,
      heros: `cra`,
      sort: `fleche_explosive`,
    });
    expect(assainirChoix({ type: `apprendre`, heros: `cra`, sort: `rekop` })).toBeNull();
    // amélioration d'un sort avancé acceptée dans une offre sauvegardée
    expect(
      assainirChoix({
        type: `sort`,
        heros: `cra`,
        sort: `fleche_explosive`,
        amelioration: `puissance`,
      }),
    ).toBeTruthy();
  });
});
