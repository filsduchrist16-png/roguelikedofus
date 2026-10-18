// Choix de récompense après un combat : améliorations de sort, reliques de run, bonus, tirage et
// sauvegarde. Chaque amélioration et chaque relique est vérifiée dans le moteur.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLASSES, MONDES, RELIQUES_RUN, SORTS } from "../src/data/index.js";
import {
  AMELIORATIONS_SORT,
  ameliorationsPossibles,
  sortAmeliore,
  textesAmeliorations,
} from "../src/combat/ameliorations.js";
import {
  calculerDegatsDetail,
  ciblesValides,
  coutPA,
  raisonIndisponible,
} from "../src/combat/stats.js";
import { lancerSort } from "../src/combat/sorts.js";
import { infligerDegats } from "../src/combat/effets.js";
import { executerCombat, ordreDeJeu } from "../src/combat/moteur.js";
import { combattantsEquipe, monstresDuCombat, nouvelleRun, pvMaxPerso } from "../src/jeu/run.js";
import { bonusEquipeRun } from "../src/jeu/rencontres.js";
import { appliquerBonusDofus } from "../src/sauvegarde/meta.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import {
  CONFIG_RECOMPENSES,
  RARETES_CHOIX,
  compensationRecompenses,
  appliquerChoix,
  assainirRecompensesRun,
  decrireChoix,
  effetsReliquesRun,
  multKamasEliteRun,
  multXpRun,
  poidsRaretes,
  reliquesRunAffichees,
  resoudreOffreCombat,
  soinFinCombat,
  soinTaverneRun,
  tirerOffreCombat,
} from "../src/jeu/recompensesRun.js";
import { appliquerRecompense, nouvelleRunSonges, tirerRecompenses } from "../src/jeu/songes.js";
import { effetsEnCours } from "../src/jeu/rencontres.js";

const ctxFixe = (rng = () => 0.99) => ({
  rng,
  log: () => {},
  playerDamageBonus: 1,
  enemyDamageBonus: 1,
});
// une équipe Iop + Cra (ou autre) préparée pour la run, en ligne avant, PV pleins
function equipe(run) {
  const heros = combattantsEquipe(run);
  heros.forEach((h, i) => {
    h.position = i;
    h.pvActuels = h.pvMax;
  });
  return heros;
}
// un monstre du Monde 1 sans résistance ni esquive, très solide
function cible(position = 0) {
  const m = monstresDuCombat(`abr_1`)[0];
  m.ref = `m_${position}`;
  m.position = position;
  m.pvBase = m.pvMax = m.pvActuels = 100000;
  m.resistances = {};
  m.stats = { ...m.stats, agilite: 0 };
  m.armure = 0;
  return m;
}
const runAvec = (classes = [`iop`, `cra`], champs = {}) =>
  Object.assign(nouvelleRun(classes, 0, `t1`), champs);
const ameliorer = (classeId, sortId, ids) => ({
  ameliorations: { [classeId]: { [sortId]: ids } },
});

describe(`Améliorations de sort`, () => {
  it(`chaque amélioration a un nom, une icône, une rareté connue et un texte`, () => {
    for (const def of Object.values(AMELIORATIONS_SORT)) {
      expect(def.nom).toBeTruthy();
      expect(def.icone).toBeTruthy();
      expect(RARETES_CHOIX).toContain(def.rarete);
      expect(def.texte(SORTS.pugilat)).toBeTruthy();
    }
  });
  it(`chaque amélioration est possible sur au moins un sort de classe`, () => {
    const sorts = Object.values(CLASSES).flatMap((classe) => classe.sorts.map((id) => SORTS[id]));
    for (const id of Object.keys(AMELIORATIONS_SORT)) {
      expect(sorts.some((sort) => ameliorationsPossibles(sort).includes(id))).toBe(true);
    }
  });
  it(`la copie améliorée ne touche pas SORTS et reste la même d'un appel à l'autre`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`puissance`])));
    const copie = sortAmeliore(iop, SORTS.colere_de_iop);
    expect(copie).not.toBe(SORTS.colere_de_iop);
    expect(SORTS.colere_de_iop.baseMax).toBe(22);
    expect(copie.baseMax).toBeCloseTo(25.3);
    expect(sortAmeliore(iop, SORTS.colere_de_iop)).toBe(copie);
    expect(sortAmeliore(iop, copie)).toBe(copie);
    expect(sortAmeliore(iop, SORTS.pugilat)).toBe(SORTS.pugilat);
  });
  it(`au plus deux améliorations par sort, jamais deux fois la même`, () => {
    expect(ameliorationsPossibles(SORTS.colere_de_iop, [`puissance`])).not.toContain(`puissance`);
    expect(ameliorationsPossibles(SORTS.colere_de_iop, [`puissance`, `economie`])).toEqual([]);
  });
  it(`Puissance : +15 % de dégâts`, () => {
    const sans = equipe(runAvec([`iop`]))[0];
    const avec = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`puissance`])))[0];
    const opts = { useMax: true, mult: 1, ctx: ctxFixe() };
    const base = calculerDegatsDetail(sans, SORTS.colere_de_iop, cible(), opts).dmg;
    const plus = calculerDegatsDetail(
      avec,
      sortAmeliore(avec, SORTS.colere_de_iop),
      cible(),
      opts,
    ).dmg;
    expect(plus / base).toBeCloseTo(1.15, 1);
  });
  it(`l'aperçu de dégâts (sort de base passé au calcul) tient compte de l'amélioration`, () => {
    const sans = equipe(runAvec([`iop`]))[0];
    const avec = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`puissance`])))[0];
    const opts = { useMax: true, mult: 1, ctx: ctxFixe() };
    const base = calculerDegatsDetail(sans, SORTS.colere_de_iop, cible(), opts).dmg;
    const apercu = calculerDegatsDetail(avec, SORTS.colere_de_iop, cible(), opts).dmg;
    expect(apercu / base).toBeCloseTo(1.15, 1);
  });
  it(`Puissance sur un soin : +15 % de PV rendus`, () => {
    const run = runAvec([`eniripsa`], ameliorer(`eniripsa`, `mot_de_solidarite`, [`puissance`]));
    const [eni] = equipe(run);
    expect(sortAmeliore(eni, SORTS.mot_de_solidarite).baseMax).toBeCloseTo(13.8);
  });
  it(`Économie : 1 PA de moins (coût, moteur et indisponibilité)`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`economie`])));
    expect(coutPA(SORTS.colere_de_iop, iop)).toBe(4);
    iop.paActuels = 4;
    expect(raisonIndisponible(iop, SORTS.colere_de_iop, [iop, cible()])).toBe(null);
  });
  it(`Recharge : 1 tour de moins`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`recharge`])));
    const m = cible();
    lancerSort(iop, SORTS.colere_de_iop, m.ref, [iop, m], ctxFixe());
    expect(iop.cooldowns.colere_de_iop).toBe(1);
  });
  it(`Allonge : le sort vise la ligne arrière`, () => {
    const devant = cible(0);
    const derriere = cible(4);
    const sans = equipe(runAvec([`iop`]))[0];
    const avec = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`allonge`])))[0];
    expect(
      ciblesValides(sans, SORTS.colere_de_iop, [sans, devant, derriere]).map((c) => c.ref),
    ).toEqual([`m_0`]);
    expect(
      ciblesValides(avec, SORTS.colere_de_iop, [avec, devant, derriere]).map((c) => c.ref),
    ).toContain(`m_4`);
  });
  it(`Précision : +10 % de critique sur ce sort`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`precision`])));
    iop.stats = { ...iop.stats, agilite: 0, crit: 0 };
    // tirage de 0,12 : raté sans l'amélioration (5 % de base), critique avec (15 %)
    let tirages = [0.99, 0.12];
    const ctx = ctxFixe(() => tirages.shift() ?? 0.99);
    const detail = calculerDegatsDetail(iop, sortAmeliore(iop, SORTS.colere_de_iop), cible(), {
      useMax: true,
      mult: 1,
      ctx,
    });
    expect(detail.crit).toBe(true);
  });
  it(`Venin : empoisonne la cible à 15 % des dégâts du coup`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`venin`])));
    const m = cible();
    lancerSort(iop, SORTS.colere_de_iop, m.ref, [iop, m], ctxFixe());
    const poison = m.effets.find((effet) => effet.stat === `poison`);
    expect(poison.valeur).toBe(Math.round((100000 - m.pvActuels) * 0.15));
    expect(poison.toursRestants).toBe(2);
  });
  it(`Vampirisme : rend 15 % des dégâts en PV`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`vampirisme`])));
    iop.pvActuels = 1;
    const m = cible();
    lancerSort(iop, SORTS.colere_de_iop, m.ref, [iop, m], ctxFixe());
    expect(iop.pvActuels).toBeGreaterThan(1);
  });
  it(`Rempart : bouclier égal à 20 % des dégâts`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`rempart`])));
    const m = cible();
    lancerSort(iop, SORTS.colere_de_iop, m.ref, [iop, m], ctxFixe());
    expect(iop.bouclier).toBe(Math.round((100000 - m.pvActuels) * 0.2));
  });
  it(`Éclaboussure : touche le reste de la rangée à 35 %`, () => {
    const [iop] = equipe(runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`eclaboussure`])));
    const a = cible(0);
    const b = cible(1);
    lancerSort(iop, SORTS.colere_de_iop, a.ref, [iop, a, b], ctxFixe());
    const degatsA = 100000 - a.pvActuels;
    const degatsB = 100000 - b.pvActuels;
    expect(degatsB).toBeGreaterThan(0);
    expect(degatsB / degatsA).toBeCloseTo(0.35, 1);
  });
  it(`textes d'amélioration pour l'info du sort`, () => {
    const [iop] = equipe(
      runAvec([`iop`], ameliorer(`iop`, `colere_de_iop`, [`puissance`, `economie`])),
    );
    expect(textesAmeliorations(iop, SORTS.colere_de_iop)).toEqual([
      `💪 Puissance : +15 % de dégâts`,
      `💠 Économie : Coûte 1 PA de moins`,
    ]);
  });
});

describe(`Reliques de run : données`, () => {
  const CLES = [
    `pvPct`,
    `initiativeBonus`,
    `multKamas`,
    `prospectionPlat`,
    `soinPlat`,
    `bouclierDebutPct`,
    `remisePremierSort`,
    `soinFinCombat`,
    `poisonDureePlus`,
    `premierCoupReduit`,
    `xpMult`,
    `soinTaverne`,
    `critPlat`,
    `resAll`,
    `esquiveBonus`,
    `paPremierTour`,
    `degatsLigneArriere`,
    `degatsAchevement`,
    `degatsPremierTour`,
    `renvoiDegats`,
    `regenTour`,
    `bouclierSurKO`,
    `kamasElite`,
    `degatsPct`,
    `koAnnule`,
    `degatsDernierDebout`,
    `ouvreToujours`,
  ];
  it(`entre 25 et 30 reliques, chacune complète, avec un effet géré`, () => {
    const liste = Object.values(RELIQUES_RUN);
    expect(liste.length).toBeGreaterThanOrEqual(25);
    expect(liste.length).toBeLessThanOrEqual(30);
    for (const relique of liste) {
      expect(RELIQUES_RUN[relique.id]).toBe(relique);
      expect(relique.nom && relique.icone && relique.desc).toBeTruthy();
      expect(RARETES_CHOIX).toContain(relique.rarete);
      for (const cle of Object.keys(relique.effet)) {
        expect(CLES).toContain(cle);
      }
    }
  });
  it(`chaque clé d'effet est utilisée par une relique`, () => {
    const utilisees = new Set(Object.values(RELIQUES_RUN).flatMap((r) => Object.keys(r.effet)));
    for (const cle of CLES) {
      expect(utilisees.has(cle)).toBe(true);
    }
  });
  it(`effets cumulés : addition, multiplication, booléens`, () => {
    const run = runAvec([`iop`], {
      reliquesRun: [`rr_bourse_kerubim`, `rr_laine_bouftou`, `rr_ailes_tofu`, `inconnue`],
    });
    expect(effetsReliquesRun(run)).toEqual({ multKamas: 1.15, pvPct: 0.06, ouvreToujours: true });
  });
  it(`affichées sur la carte (effets en cours) avec emoji, nom et effet`, () => {
    const run = runAvec([`iop`], { reliquesRun: [`rr_plume_phenix`] });
    const effet = effetsEnCours(run, undefined).find((e) => e.reliqueRun);
    expect(effet.icone).toBe(`🔥`);
    expect(effet.nom).toBe(`Plume de Phénix`);
    expect(effet.desc).toContain(`1 PV`);
    expect(reliquesRunAffichees(runAvec([`iop`]))).toEqual([]);
  });
});

// Héros d'une run avec ces reliques, bonus de stats appliqués comme en jeu
function herosAvec(reliques, classes = [`iop`, `cra`]) {
  const run = runAvec(classes, { reliquesRun: reliques });
  const heros = equipe(run);
  appliquerBonusDofus(heros, bonusEquipeRun({ dofus: [] }, run));
  return { run, heros };
}
describe(`Reliques de run : effets`, () => {
  const sans = herosAvec([]).heros[0];
  it(`stats : PV, initiative, Soin, critique, résistance, esquive, bouclier de départ`, () => {
    expect(herosAvec([`rr_laine_bouftou`]).heros[0].pvMax).toBe(
      sans.pvMax + Math.round(sans.pvMax * 0.06),
    );
    expect(herosAvec([`rr_plume_tofu`]).heros[0].initiative).toBe(sans.initiative + 4);
    expect(herosAvec([`rr_fiole_eniripsa`]).heros[0].stats.soin).toBe((sans.stats.soin ?? 0) + 15);
    expect(herosAvec([`rr_de_ecaflip`]).heros[0].stats.crit).toBe((sans.stats.crit ?? 0) + 4);
    expect(herosAvec([`rr_carapace_kwak`]).heros[0].resistances.feu).toBeCloseTo(
      (sans.resistances.feu ?? 0) + 0.04,
    );
    expect(herosAvec([`rr_trefle`]).heros[0].esquiveBonus).toBeCloseTo(
      (sans.esquiveBonus ?? 0) + 0.04,
    );
    expect(herosAvec([`rr_ecu_feca`]).heros[0].bouclier).toBe(Math.round(sans.pvMax * 0.08));
  });
  it(`kamas, prospection et dégâts passent par les bonus d'équipe`, () => {
    const base = bonusEquipeRun({ dofus: [] }, runAvec());
    expect(
      bonusEquipeRun({ dofus: [] }, runAvec([`iop`], { reliquesRun: [`rr_bourse_kerubim`] }))
        .multKamas,
    ).toBeCloseTo(base.multKamas * 1.15);
    expect(
      bonusEquipeRun({ dofus: [] }, runAvec([`iop`], { reliquesRun: [`rr_pioche_mineur`] }))
        .prospection,
    ).toBe(base.prospection + 25);
    expect(
      bonusEquipeRun({ dofus: [] }, runAvec([`iop`], { reliquesRun: [`rr_bandeau_goultard`] }))
        .damageMult,
    ).toBeCloseTo(base.damageMult * 1.06);
  });
  it(`Ailes de Tofu royal : les héros jouent en premier`, () => {
    const { heros } = herosAvec([`rr_ailes_tofu`], [`iop`]);
    const m = cible();
    m.initiative = 9999;
    expect(ordreDeJeu([...heros, m])[0]).toBe(heros[0].ref);
  });
  it(`Sablier : +1 PA au premier tour seulement`, async () => {
    const { heros } = herosAvec([`rr_sablier_xelor`], [`iop`]);
    const [iop] = heros;
    const m = cible();
    m.sorts = [];
    const pa = [];
    await executerCombat([iop, m], {
      rng: () => 0.5,
      controllers: {
        joueur: (acteur) => {
          pa.push(acteur.paActuels);
          if (pa.length >= 2) {
            m.pvActuels = 0;
          }
          return null;
        },
        ennemi: () => null,
      },
    });
    expect(pa).toEqual([iop.paMax + 1, iop.paMax]);
  });
  it(`Parchemin d'éveil : le premier sort coûte 1 PA de moins, puis plus`, () => {
    const [iop] = herosAvec([`rr_parchemin_eveil`], [`iop`]).heros;
    expect(coutPA(SORTS.colere_de_iop, iop)).toBe(4);
    expect(coutPA(SORTS.pugilat, iop)).toBe(1);
    iop.remisePremierSort = 0;
    expect(coutPA(SORTS.colere_de_iop, iop)).toBe(5);
  });
  it(`Parchemin d'éveil : consommé par le moteur au premier lancer`, async () => {
    const [iop] = herosAvec([`rr_parchemin_eveil`], [`iop`]).heros;
    const m = cible();
    m.sorts = [];
    let lancers = 0;
    await executerCombat([iop, m], {
      rng: () => 0.99,
      controllers: {
        joueur: (acteur) => {
          if (lancers++ >= 1) {
            m.pvActuels = 0;
            return null;
          }
          return { sort: SORTS.colere_de_iop, cibleRef: m.ref };
        },
        ennemi: () => null,
      },
    });
    expect(iop.remisePremierSort).toBe(0);
  });
  it(`Lunette de Cra : +15 % contre la ligne arrière`, () => {
    const [iop] = herosAvec([`rr_lunette_cra`], [`iop`]).heros;
    const opts = { useMax: true, mult: 1, ctx: ctxFixe() };
    const avant = calculerDegatsDetail(iop, SORTS.colere_de_iop, cible(0), opts).dmg;
    const arriere = calculerDegatsDetail(iop, SORTS.colere_de_iop, cible(4), opts).dmg;
    expect(arriere / avant).toBeCloseTo(1.15, 1);
  });
  it(`Crocs de Milimulou : +20 % contre un ennemi sous 30 % de ses PV`, () => {
    const [iop] = herosAvec([`rr_crocs_milimulou`], [`iop`]).heros;
    const opts = { useMax: true, mult: 1, ctx: ctxFixe() };
    const plein = calculerDegatsDetail(iop, SORTS.colere_de_iop, cible(), opts).dmg;
    const blesse = cible();
    blesse.pvActuels = 20000;
    expect(calculerDegatsDetail(iop, SORTS.colere_de_iop, blesse, opts).dmg / plein).toBeCloseTo(
      1.2,
      1,
    );
  });
  it(`Cor de guerre Bwork : +20 % au premier tour seulement`, () => {
    const [iop] = herosAvec([`rr_cor_bwork`], [`iop`]).heros;
    const opts = { useMax: true, mult: 1, ctx: ctxFixe() };
    iop.toursJoues = 2;
    const normal = calculerDegatsDetail(iop, SORTS.colere_de_iop, cible(), opts).dmg;
    iop.toursJoues = 1;
    expect(calculerDegatsDetail(iop, SORTS.colere_de_iop, cible(), opts).dmg / normal).toBeCloseTo(
      1.2,
      1,
    );
  });
  it(`Cœur de Iop : +30 % quand il ne reste qu'un héros debout`, () => {
    const [iop, cra] = herosAvec([`rr_coeur_iop`]).heros;
    const m = cible();
    const ctx = { ...ctxFixe(), combatants: [iop, cra, m] };
    const opts = { useMax: true, mult: 1, ctx };
    const deux = calculerDegatsDetail(iop, SORTS.colere_de_iop, m, opts).dmg;
    cra.pvActuels = 0;
    expect(calculerDegatsDetail(iop, SORTS.colere_de_iop, m, opts).dmg / deux).toBeCloseTo(1.3, 1);
  });
  it(`Venin d'Arakne : les poisons des héros durent 1 tour de plus`, () => {
    const [sadi] = herosAvec([`rr_venin_arakne`], [`sadida`]).heros;
    const m = cible();
    lancerSort(sadi, SORTS.seve_paralysante, m.ref, [sadi, m], ctxFixe());
    expect(m.effets.find((effet) => effet.stat === `poison`).toursRestants).toBe(4);
  });
  it(`Carapace de Scarafeuille : le premier coup reçu est réduit de moitié`, () => {
    const [iop] = herosAvec([`rr_carapace_scarafeuille`], [`iop`]).heros;
    const m = cible();
    const pv = iop.pvActuels;
    infligerDegats(iop, 20, m, ctxFixe());
    expect(pv - iop.pvActuels).toBe(10);
    infligerDegats(iop, 20, m, ctxFixe());
    expect(pv - iop.pvActuels).toBe(30);
  });
  it(`Plume de Phénix : un seul K.O. annulé par combat`, () => {
    const [iop, cra] = herosAvec([`rr_plume_phenix`]).heros;
    const m = cible();
    const ctx = ctxFixe();
    infligerDegats(iop, 99999, m, ctx);
    expect(iop.pvActuels).toBe(1);
    infligerDegats(cra, 99999, m, ctx);
    expect(cra.pvActuels).toBe(0);
  });
  it(`Ronces de Sadida : 10 % des dégâts subis reviennent à l'attaquant`, () => {
    const [iop] = herosAvec([`rr_ronces_sadida`], [`iop`]).heros;
    const m = cible();
    infligerDegats(iop, 50, m, { ...ctxFixe(), combatants: [iop, m] });
    expect(100000 - m.pvActuels).toBe(5);
  });
  it(`Trophée de chasseur : achever un ennemi donne un bouclier`, () => {
    const [iop] = herosAvec([`rr_trophee_chasseur`], [`iop`]).heros;
    const m = cible();
    m.pvActuels = 5;
    infligerDegats(m, 10, iop, { ...ctxFixe(), combatants: [iop, m] });
    expect(iop.bouclier).toBe(Math.round(iop.pvMax * 0.08));
  });
  it(`Graine de l'Arbre de Vie : 3 % des PV max au début du tour`, async () => {
    const [iop] = herosAvec([`rr_graine_sadida`], [`iop`]).heros;
    iop.pvActuels = 10;
    const m = cible();
    m.sorts = [];
    await executerCombat([iop, m], {
      rng: () => 0.5,
      controllers: {
        joueur: () => {
          m.pvActuels = 0;
          return null;
        },
        ennemi: () => null,
      },
    });
    expect(iop.pvActuels).toBe(10 + Math.max(1, Math.round(iop.pvMax * 0.03)));
  });
  it(`Bandages, Grimoire, Insigne et Chope : soin de fin de combat, XP, kamas d'élite, taverne`, () => {
    const run = runAvec([`iop`, `cra`], {
      reliquesRun: [
        `rr_bandages_rykke`,
        `rr_grimoire_apprenti`,
        `rr_insigne_milice`,
        `rr_chope_taverne`,
      ],
    });
    const [iop, cra] = run.persos;
    iop.pvActuels = 1;
    cra.pvActuels = 0;
    soinFinCombat(run);
    expect(iop.pvActuels).toBe(1 + Math.round(pvMaxPerso(iop) * 0.05));
    expect(cra.pvActuels).toBe(0);
    expect(multXpRun(run)).toBeCloseTo(1.15);
    expect(multKamasEliteRun(run, `combat_dur`)).toBe(1.5);
    expect(multKamasEliteRun(run, `combat`)).toBe(1);
    expect(soinTaverneRun(run, 0.5)).toBeCloseTo(0.7);
    expect(soinTaverneRun(run, 0.9)).toBe(1);
    expect(soinFinCombat(runAvec())).toBe(0);
  });
});

describe(`Compensation`, () => {
  it(`les monstres gagnent de la puissance au fil des zones d'un monde (1 en zone 1)`, () => {
    const { t1, autres } = CONFIG_RECOMPENSES.compensation;
    expect(compensationRecompenses(`incarnam`)).toBe(1);
    expect(compensationRecompenses(MONDES[0].zones[3])).toBeCloseTo(1 + 3 * t1.lin + 9 * t1.quad);
    const t5 = MONDES.find((monde) => monde.id === `t5`);
    expect(compensationRecompenses(t5.zones[0])).toBe(1);
    expect(compensationRecompenses(t5.zones.at(-1))).toBeCloseTo(
      1 + 11 * autres.lin + 121 * autres.quad,
    );
    expect(compensationRecompenses(`zone_inconnue`)).toBe(1);
    // toujours croissante dans un monde
    for (const monde of MONDES) {
      for (let i = 1; i < monde.zones.length; i++) {
        expect(compensationRecompenses(monde.zones[i])).toBeGreaterThan(
          compensationRecompenses(monde.zones[i - 1]),
        );
      }
    }
  });
});

describe(`Tirage de l'offre`, () => {
  it(`trois cartes différentes, tirées de façon reproductible`, () => {
    const offre = tirerOffreCombat(runAvec(), { numZone: 3, rng: rngGraine(7) });
    expect(offre.choix).toHaveLength(3);
    expect(offre.passer).toBeGreaterThan(0);
    expect(offre.choix[0].type).toBe(`sort`);
    expect(offre.choix[2].type).toBe(`bonus`);
    expect(tirerOffreCombat(runAvec(), { numZone: 3, rng: rngGraine(7) })).toEqual(offre);
    const cibles = offre.choix.filter((c) => c.type === `sort`).map((c) => `${c.heros}:${c.sort}`);
    expect(new Set(cibles).size).toBe(cibles.length);
  });
  it(`les élites proposent plus de reliques et de raretés élevées`, () => {
    let reliquesNormal = 0;
    let reliquesElite = 0;
    for (let graine = 1; graine <= 200; graine++) {
      reliquesNormal += tirerOffreCombat(runAvec(), { rng: rngGraine(graine) }).choix.filter(
        (c) => c.type === `relique`,
      ).length;
      reliquesElite += tirerOffreCombat(runAvec(), {
        elite: true,
        rng: rngGraine(graine),
      }).choix.filter((c) => c.type === `relique`).length;
    }
    expect(reliquesElite).toBeGreaterThan(reliquesNormal * 2);
    expect(poidsRaretes(true).epique).toBeGreaterThan(poidsRaretes(false).epique);
    expect(poidsRaretes(false, 1).epique).toBeGreaterThan(poidsRaretes(false, 0).epique);
  });
  it(`jamais une relique déjà possédée`, () => {
    const toutes = Object.keys(RELIQUES_RUN);
    const run = runAvec([`iop`, `cra`], { reliquesRun: toutes.slice(1) });
    for (let graine = 1; graine <= 50; graine++) {
      for (const choix of tirerOffreCombat(run, { elite: true, rng: rngGraine(graine) }).choix) {
        if (choix.type === `relique`) {
          expect(choix.id).toBe(toutes[0]);
        }
      }
    }
  });
  it(`mort définitive : pas d'amélioration pour un héros tombé`, () => {
    const run = runAvec([`iop`, `cra`], { ascension: 3 });
    run.persos[0].pvActuels = 0;
    for (let graine = 1; graine <= 30; graine++) {
      for (const choix of tirerOffreCombat(run, { rng: rngGraine(graine) }).choix) {
        expect(choix.heros === undefined || choix.heros === run.persos[1].classeId).toBe(true);
      }
    }
  });
  it(`chaque carte a un texte complet`, () => {
    for (let graine = 1; graine <= 30; graine++) {
      const run = runAvec();
      for (const choix of tirerOffreCombat(run, { elite: true, rng: rngGraine(graine) }).choix) {
        const d = decrireChoix(choix, run);
        expect(d.titre && d.effet && d.sousTitre && d.icone).toBeTruthy();
      }
    }
  });
});

describe(`Application du choix`, () => {
  it(`amélioration, relique, kamas, repos, caractéristiques et « Passer »`, () => {
    const run = runAvec();
    appliquerChoix(run, {
      type: `sort`,
      heros: `iop`,
      sort: `colere_de_iop`,
      amelioration: `economie`,
    });
    expect(run.ameliorations).toEqual({ iop: { colere_de_iop: [`economie`] } });
    expect(coutPA(SORTS.colere_de_iop, combattantsEquipe(run)[0])).toBe(4);
    appliquerChoix(run, { type: `relique`, id: `rr_plume_tofu` });
    appliquerChoix(run, { type: `relique`, id: `rr_plume_tofu` });
    expect(run.reliquesRun).toEqual([`rr_plume_tofu`]);
    appliquerChoix(run, { type: `bonus`, bonus: `kamas`, montant: 40 });
    expect(run.kamas).toBe(40);
    run.persos[0].pvActuels = 1;
    appliquerChoix(run, { type: `bonus`, bonus: `soin`, pct: 0.35 });
    expect(run.persos[0].pvActuels).toBe(1 + Math.round(pvMaxPerso(run.persos[0]) * 0.35));
    const force = combattantsEquipe(run)[1].stats.agilite;
    appliquerChoix(run, {
      type: `bonus`,
      bonus: `stats`,
      heros: run.persos[1].classeId,
      valeur: 7,
    });
    expect(combattantsEquipe(run)[1].stats.agilite).toBe(force + 7);
    run.offreCombat = { elite: false, choix: [], passer: 12 };
    resoudreOffreCombat(run, `passer`);
    expect(run.kamas).toBe(52);
    expect(run.offreCombat).toBe(null);
  });
});

describe(`Songes : améliorations de sort et reliques de run proposées`, () => {
  it(`le tirage des Songes peut proposer une amélioration de sort et une relique`, () => {
    const types = new Set();
    for (let graine = 1; graine <= 40; graine++) {
      const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(graine));
      for (const r of tirerRecompenses(4, run, rngGraine(graine + 100))) {
        types.add(r.type);
      }
    }
    expect(types.has(`sort`)).toBe(true);
    expect(types.has(`relique`)).toBe(true);
  });
  it(`appliquerRecompense gère les deux nouveaux types`, () => {
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    appliquerRecompense(run, { type: `relique`, id: `rr_trefle` });
    appliquerRecompense(run, {
      type: `sort`,
      heros: `iop`,
      sort: `pugilat`,
      amelioration: `puissance`,
    });
    expect(run.reliquesRun).toEqual([`rr_trefle`]);
    expect(run.ameliorations.iop.pugilat).toEqual([`puissance`]);
  });
});

describe(`Sauvegarde`, () => {
  function stockage() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    };
  }
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = stockage();
  });
  it(`ancienne sauvegarde sans ces champs : vides`, () => {
    const run = assainirRecompensesRun({ persos: [] });
    expect(run.ameliorations).toEqual({});
    expect(run.reliquesRun).toEqual([]);
    expect(run.bonusStats).toEqual({});
    expect(run.offreCombat).toBe(null);
  });
  it(`valeurs inconnues retirées`, () => {
    const run = assainirRecompensesRun({
      ameliorations: {
        iop: { colere_de_iop: [`puissance`, `bidon`, `puissance`], inconnu: [`puissance`] },
        zzz: {},
      },
      reliquesRun: [`rr_trefle`, `bidon`, `rr_trefle`],
      bonusStats: { iop: 12, zzz: 3, cra: `x` },
      offreCombat: {
        elite: 1,
        choix: [
          { type: `relique`, id: `bidon` },
          { type: `bonus`, bonus: `kamas`, montant: 30 },
        ],
        passer: 9,
      },
    });
    expect(run.ameliorations).toEqual({ iop: { colere_de_iop: [`puissance`] } });
    expect(run.reliquesRun).toEqual([`rr_trefle`]);
    expect(run.bonusStats).toEqual({ iop: 12 });
    expect(run.offreCombat).toEqual({
      elite: true,
      choix: [{ type: `bonus`, bonus: `kamas`, montant: 30 }],
      passer: 9,
    });
  });
  it(`l'offre en attente et les améliorations survivent à un rechargement`, async () => {
    const { sauverRun, chargerRun } = await import(`../src/sauvegarde/run.js`);
    const run = runAvec();
    appliquerChoix(run, {
      type: `sort`,
      heros: `cra`,
      sort: `fleche_punitive`,
      amelioration: `allonge`,
    });
    appliquerChoix(run, { type: `relique`, id: `rr_sablier_xelor` });
    run.offreCombat = tirerOffreCombat(run, { elite: true, numZone: 2, rng: rngGraine(3) });
    const offre = structuredClone(run.offreCombat);
    sauverRun(1, run);
    const charge = chargerRun();
    expect(charge.run.offreCombat).toEqual(offre);
    expect(charge.run.ameliorations).toEqual({ cra: { fleche_punitive: [`allonge`] } });
    expect(charge.run.reliquesRun).toEqual([`rr_sablier_xelor`]);
  });
  it(`une run de songes garde ses cartes d'amélioration et de relique`, async () => {
    const { sauverRun, chargerRun } = await import(`../src/sauvegarde/run.js`);
    const run = nouvelleRunSonges([`iop`, `cra`], rngGraine(1));
    run.offreSonge = [
      { type: `sort`, heros: `iop`, sort: `pugilat`, amelioration: `venin` },
      { type: `relique`, id: `rr_trefle` },
      { type: `relique`, id: `bidon` },
    ];
    sauverRun(0, run);
    expect(chargerRun().run.offreSonge).toEqual(run.offreSonge.slice(0, 2));
  });
});
