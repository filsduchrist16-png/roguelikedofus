// Rencontres du Krosmoz et quêtes de l'Almanax de la 1.9.0.
import { describe, expect, it } from "vitest";
import { BENEDICTIONS, gainBase, tirerRencontre } from "../src/jeu/rencontres.js";
import { CLASSES, RELIQUES_RUN, RENCONTRES } from "../src/data/index.js";
import {
  RENCONTRES_LORE,
  appliquerEffetsLore,
  estRencontreLore,
  payerChoix,
  preparerRencontreLore,
  prixChoix,
  tirerIssue,
} from "../src/jeu/rencontresLore.js";
import { nouvelleRun, pvMaxPerso } from "../src/jeu/run.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import {
  QUETES_ALMANAX,
  etatAlmanax,
  normaliserAlmanax,
  progresserAlmanax,
  queteAlmanaxConnue,
} from "../src/jeu/almanax.js";

const EFFETS_CONNUS = new Set([
  `kamas`,
  `perteKamasPct`,
  `soinPct`,
  `pertePvPct`,
  `stats`,
  `xp`,
  `amelioration`,
  `apprendre`,
  `relique`,
  `benediction`,
  `sacrificePv`,
]);

describe(`rencontres du Krosmoz : données`, () => {
  it(`sept rencontres, chacune avec des choix à issues valides et un choix pour partir`, () => {
    expect(RENCONTRES_LORE.length).toBe(7);
    for (const [id, def] of Object.entries(RENCONTRES)) {
      expect(estRencontreLore(id)).toBe(true);
      expect(def.titre.length).toBeGreaterThan(5);
      expect(def.texte.length).toBeGreaterThan(40);
      expect(def.choix.length).toBeGreaterThanOrEqual(3);
      for (const choix of def.choix) {
        expect(choix.libelle, `${id}.${choix.id}`).toBeTruthy();
        for (const issue of choix.issues ?? []) {
          expect(issue.chance).toBeGreaterThan(0);
          expect(issue.titre && issue.texte, `${id}.${choix.id}`).toBeTruthy();
          for (const cle of Object.keys(issue.effets ?? {})) {
            expect(EFFETS_CONNUS.has(cle), `${id}.${choix.id} : ${cle}`).toBe(true);
          }
          if (issue.effets?.benediction) {
            expect(BENEDICTIONS[issue.effets.benediction]).toBeDefined();
          }
          if (issue.combat) expect([`normal`, `elite`]).toContain(issue.combat);
        }
        if (choix.issues?.length) {
          expect(choix.detail, `${id}.${choix.id} : risque et récompense annoncés`).toBeTruthy();
        }
      }
      // au moins un choix sans risque pour s'en aller (ou un choix « sans rien perdre »)
      expect(def.choix.some((c) => !c.issues?.length)).toBe(def.choix.at(-1).id === `partir`);
    }
  });
  it(`elles sortent du tirage des rencontres`, () => {
    const rng = rngGraine(5);
    const vus = new Set(Array.from({ length: 800 }, () => tirerRencontre(rng)));
    for (const id of RENCONTRES_LORE) expect(vus.has(id), id).toBe(true);
  });
});

describe(`rencontres du Krosmoz : effets`, () => {
  it(`préparation : textes sans balise, prix en kamas, choix bloqué sans assez de kamas`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    run.kamas = 0;
    for (const id of RENCONTRES_LORE) {
      const r = preparerRencontreLore(run, id, { rng: rngGraine(1), toile: 3 });
      expect(JSON.stringify(r)).not.toMatch(/\{heros\}|\{stats\}/);
      for (const choix of r.choix) {
        const def = RENCONTRES[id].choix.find((c) => c.id === choix.id);
        if (def.prix) {
          expect(choix.prix).toBe(prixChoix(def, 3));
          expect(choix.desactive).toMatch(/kamas/);
        }
      }
    }
    const dopeul = preparerRencontreLore(run, `dopeul`, { rng: rngGraine(1) });
    expect(dopeul.img).toBe(CLASSES[dopeul.heros].img);
    expect(dopeul.texte).toContain(CLASSES[dopeul.heros].nom);
  });
  it(`chaque issue de chaque choix s'applique sans erreur et change la run`, () => {
    for (const id of RENCONTRES_LORE) {
      for (const choix of RENCONTRES[id].choix) {
        for (const issue of choix.issues ?? []) {
          const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
          run.kamas = 1000;
          for (const p of run.persos) p.pvActuels = Math.round(pvMaxPerso(p) / 2);
          const avant = JSON.stringify(run);
          const gains = [];
          const lignes = appliquerEffetsLore(run, issue.effets, {
            rng: rngGraine(2),
            toile: 2,
            heros: `cra`,
            gains,
          });
          expect(lignes.length, `${id}.${choix.id}`).toBeGreaterThan(0);
          expect(JSON.stringify(run), `${id}.${choix.id}`).not.toBe(avant);
          if (issue.effets.relique) expect(gains).toContain(`relique`);
          if (issue.effets.apprendre) {
            expect(run.persos.find((p) => p.classeId === `cra`).sortsAppris).toEqual([
              CLASSES.cra.sortsAvances[0],
            ]);
          }
          if (issue.effets.pertePvPct) {
            expect(run.persos.every((p) => p.pvActuels >= 1)).toBe(true);
          }
        }
      }
    }
  });
  it(`tirage d'une issue, paiement, pacte de sang plafonné et repli quand tout est pris`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    expect(tirerIssue(`otomai`, `partir`, rngGraine(1))).toBeNull();
    expect(tirerIssue(`otomai`, `boire`, () => 0.1).effets.stats).toBeTruthy();
    expect(tirerIssue(`otomai`, `boire`, () => 0.9).effets.pertePvPct).toBeTruthy();
    run.kamas = 10;
    expect(payerChoix(run, `marchand_ames`, `pierre`, 1)).toBe(false);
    run.kamas = 1000;
    expect(payerChoix(run, `marchand_ames`, `pierre`, 1)).toBe(true);
    expect(run.kamas).toBe(1000 - Math.round(1.6 * gainBase(1)));
    run.sacrificePv = 0.38;
    const prep = preparerRencontreLore(run, `marchand_ames`, { rng: rngGraine(1) });
    expect(prep.choix.find((c) => c.id === `vendre`).desactive).toMatch(/40 %/);
    // toutes les reliques prises : des kamas à la place ; bénédiction déjà active : des kamas
    run.reliquesRun = Object.keys(RELIQUES_RUN);
    run.benedictions = [`feca`];
    const kamas = run.kamas;
    appliquerEffetsLore(run, { relique: `rare`, benediction: `feca` }, { rng: rngGraine(1) });
    expect(run.kamas).toBeGreaterThan(kamas);
    // au niveau max du monde, le choix d'XP est bloqué
    for (const p of run.persos) p.progression.niveau = 50;
    const rubilax = preparerRencontreLore(run, `rubilax`, { rng: rngGraine(1) });
    expect(rubilax.choix.find((c) => c.id === `sceller`).desactive).toMatch(/niveau maximal/);
  });
});

describe(`Almanax 1.9.0`, () => {
  it(`six quêtes de plus, chacune réalisable par un évènement de run`, () => {
    const nouvelles = [
      [`combats`, { type: `combat`, gagne: true }],
      [`elite_sans_ko`, { type: `combat`, gagne: true, noeud: `combat_dur`, herosKO: false }],
      [`rencontres`, { type: `rencontre` }],
      [`ameliorations`, { type: `recompense`, gain: `sort` }],
      [`nouveau_sort`, { type: `recompense`, gain: `apprendre` }],
      [`reliques`, { type: `recompense`, gain: `relique` }],
    ];
    expect(QUETES_ALMANAX.length).toBe(18);
    for (const [id, evenement] of nouvelles) {
      const quete = QUETES_ALMANAX.find((q) => q.id === id);
      expect(quete, id).toBeDefined();
      expect(quete.compte(evenement)).toBe(1);
      expect(quete.compte({ type: `zone` })).toBe(0);
    }
    expect(QUETES_ALMANAX.find((q) => q.id === `elite_sans_ko`).compte(nouvelles[1][1])).toBe(1);
    expect(
      QUETES_ALMANAX.find((q) => q.id === `elite_sans_ko`).compte({
        ...nouvelles[1][1],
        herosKO: true,
      }),
    ).toBe(0);
  });
  it(`le progrès retient sa quête : une autre quête ce jour-là repart de zéro`, () => {
    const date = `2026-03-14`;
    const meta = {};
    const quete = etatAlmanax(meta, date).quete;
    const evenement = {
      type: `recompense`,
      gain: `sort`,
      gagne: true,
      noeud: `combat_dur`,
      rondes: 1,
      defiOk: true,
      coups: { terre: 20, feu: 20, eau: 20, air: 20 },
    };
    // trouve un évènement qui fait avancer la quête du jour
    const candidats = [
      evenement,
      { ...evenement, type: `combat` },
      { type: `zone` },
      { type: `camp` },
      { type: `coffre` },
      { type: `rencontre` },
      { type: `recompense`, gain: `apprendre` },
      { type: `recompense`, gain: `relique` },
    ];
    const bon = candidats.find((e) => quete.compte(e) > 0);
    expect(bon, quete.id).toBeDefined();
    progresserAlmanax(meta, bon, date);
    expect(meta.almanax.quete).toBe(quete.id);
    expect(etatAlmanax(meta, date).progres).toBeGreaterThan(0);
    meta.almanax.quete = QUETES_ALMANAX.find((q) => q.id !== quete.id).id;
    expect(etatAlmanax(meta, date).progres).toBe(0);
    // ancienne sauvegarde sans quête notée : le progrès compte encore
    delete meta.almanax.quete;
    expect(etatAlmanax(meta, date).progres).toBeGreaterThan(0);
    expect(normaliserAlmanax({ date, quete: `inconnue`, progres: 1 }).quete).toBeUndefined();
    expect(normaliserAlmanax({ date, quete: `combats`, progres: 1 }).quete).toBe(`combats`);
    expect(queteAlmanaxConnue(`nouveau_sort`)).toBe(true);
  });
});
