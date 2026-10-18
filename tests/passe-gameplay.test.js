// Passe de gameplay 1.8.0 : carte à vrais choix (camp, coffre, élites plus généreuses), reliques de
// run hors combat (colporteur, autel de sang, taverne) et synergies de reliques.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMBATS, MONDES, RELIQUES_RUN, SORTS, SYNERGIES_RUN } from "../src/data/index.js";
import { genererCarte, noeudsAtteignables, trouverNoeud } from "../src/carte/generation.js";
import { CONFIG_CARTE, getMonde, zonesDuMonde } from "../src/jeu/config.js";
import { rngGraine } from "../src/jeu/runDuJour.js";
import {
  combattantsEquipe,
  monstresDuCombat,
  noeudsExclus,
  nouvelleRun,
  pvMaxPerso,
} from "../src/jeu/run.js";
import {
  CONFIG_RECOMPENSES,
  decrireChoix,
  effetsReliquesRun,
  reliquesRunAffichees,
  sacrificePvRun,
  synergiesActives,
  texteSynergies,
  tirerOffreCombat,
  assainirRecompensesRun,
} from "../src/jeu/recompensesRun.js";
import {
  MARGE_TAVERNE,
  SACRIFICE_AUTEL,
  acheterReliqueRun,
  contenuCoffre,
  optionsCamp,
  pacteAutel,
  peutCrocheterCoffre,
  piegePv,
  prixReliqueRun,
  reliqueDeCoffre,
  reliquesProposees,
  reliqueTaverne,
  reposCamp,
} from "../src/jeu/cases.js";
import { bonusEquipeRun, effetsEnCours, rencontresExclues } from "../src/jeu/rencontres.js";
import { appliquerBonusDofus } from "../src/sauvegarde/meta.js";
import { lancerSort } from "../src/combat/sorts.js";
import { texteCase } from "../src/ui/ecrans/carte.js";

const runAvec = (classes = [`iop`, `cra`], champs = {}) =>
  Object.assign(nouvelleRun(classes, 0, `t1`), champs);

// ---------- Carte ----------
describe(`carte : vrais choix de chemin`, () => {
  // propriétés vérifiées sur chaque carte générée
  function verifierCarte(carte, exclus) {
    const parId = new Map(carte.noeuds.map((noeud) => [noeud.id, noeud]));
    const lignes = Math.max(...carte.noeuds.map((noeud) => noeud.ligne));
    const donjon = carte.noeuds.filter((noeud) => noeud.type === `donjon`);
    expect(donjon.length).toBe(1);
    // toutes les cases sont atteignables depuis le départ…
    const vus = new Set();
    const pile = [...carte.depart];
    while (pile.length) {
      const id = pile.pop();
      if (vus.has(id)) {
        continue;
      }
      vus.add(id);
      pile.push(...parId.get(id).suivants);
    }
    expect(vus.size).toBe(carte.noeuds.length);
    for (const noeud of carte.noeuds) {
      // … et chacune mène au donjon (aucune impasse)
      if (noeud.type !== `donjon`) {
        expect(noeud.suivants.length).toBeGreaterThan(0);
      }
      expect(exclus.includes(noeud.type)).toBe(false);
      if ([`combat`, `combat_dur`, `donjon`].includes(noeud.type)) {
        expect(COMBATS[noeud.combatId]).toBeTruthy();
      }
      if (noeud.type === `coffre`) {
        expect([`relique`, `objet`]).toContain(noeud.tresor);
        expect([undefined, `combat`, `pv`]).toContain(noeud.piege);
        if (noeud.piege === `combat`) {
          expect(COMBATS[noeud.combatId]).toBeTruthy();
        }
      }
      // embranchement réel : deux cases suivantes de types différents
      if (noeud.suivants.length === 2 && noeud.ligne > 0 && noeud.ligne < lignes - 1) {
        const [a, b] = noeud.suivants.map((id) => parId.get(id).type);
        expect(a).not.toBe(b);
      }
    }
    // au moins un choix réel par étage : chaque rangée intermédiaire a deux types au moins
    for (let ligne = 1; ligne < lignes; ligne++) {
      const types = new Set(
        carte.noeuds.filter((noeud) => noeud.ligne === ligne).map((noeud) => noeud.type),
      );
      expect(types.size).toBeGreaterThanOrEqual(2);
    }
    // départ : deux groupes de monstres différents
    const [d1, d2] = carte.depart.map((id) => parId.get(id));
    expect(d1.combatId).not.toBe(d2.combatId);
    // un camp juste avant le donjon, et un combat dur quelque part
    const avantBoss = carte.noeuds.filter((noeud) => noeud.ligne === lignes - 1);
    expect(avantBoss.some((noeud) => noeud.type === `camp`)).toBe(true);
    expect(carte.noeuds.some((noeud) => noeud.type === `combat_dur`)).toBe(true);
  }
  for (const monde of MONDES) {
    it(`${monde.id} : 200 graines, aucun chemin impossible, un choix réel par étage`, () => {
      const zones = zonesDuMonde(getMonde(monde.id));
      const run = runAvec();
      for (let graine = 0; graine < 200; graine++) {
        const indice = graine % zones.length;
        const zone = zones[indice];
        const exclus = noeudsExclus(run, zone);
        const carte = genererCarte(rngGraine(graine * 31 + 7), zone.pools, exclus, {
          premiereZone: indice === 0,
        });
        verifierCarte(carte, exclus);
      }
    });
  }
  it(`les poids de la carte comptent le camp et le coffre (aussi derrière un zaap)`, () => {
    expect(CONFIG_CARTE.poids.camp).toBeGreaterThan(0);
    expect(CONFIG_CARTE.poids.coffre).toBeGreaterThan(0);
  });
  it(`une carte d'avant la 1.8.0 (sans camp ni coffre) reste jouable`, () => {
    const ancienne = {
      courant: `n0_0`,
      depart: [`n0_0`, `n0_1`],
      noeuds: [
        { id: `n0_0`, type: `combat`, ligne: 0, colonne: -0.5, suivants: [`n1_0`], visite: true },
        { id: `n0_1`, type: `combat`, ligne: 0, colonne: 0.5, suivants: [`n1_0`] },
        { id: `n1_0`, type: `taverne`, ligne: 1, colonne: 0, suivants: [`n2_0`] },
        { id: `n2_0`, type: `donjon`, ligne: 2, colonne: 0, suivants: [], combatId: `abr_boss` },
      ],
    };
    expect(noeudsAtteignables(ancienne).map((noeud) => noeud.id)).toEqual([`n1_0`]);
    expect(trouverNoeud(ancienne, `n2_0`).type).toBe(`donjon`);
  });
  it(`le panneau d'une case annonce son contenu et la récompense d'un combat dur`, () => {
    const elite = texteCase({ type: `combat_dur`, combatId: `abr_2`, eliteModifs: [`cuirasse`] });
    expect(elite).toMatch(/relique de run garantie/);
    expect(texteCase({ type: `camp` })).toMatch(/30 %/);
    expect(texteCase({ type: `coffre` })).toMatch(/piégé/);
    expect(texteCase({ type: `rencontre` })).toMatch(/reliques/);
  });
});

describe(`élites plus généreuses`, () => {
  it(`un combat dur propose toujours une relique, et des cartes plus rares`, () => {
    expect(CONFIG_RECOMPENSES.chanceRelique.elite).toBe(1);
    for (let graine = 0; graine < 40; graine++) {
      const offre = tirerOffreCombat(runAvec(), { elite: true, rng: rngGraine(graine) });
      expect(offre.choix.some((choix) => choix.type === `relique`)).toBe(true);
    }
    const { elite, normal } = CONFIG_RECOMPENSES.raretes;
    expect(elite.epique).toBeGreaterThan(normal.epique * 5);
  });
});

// ---------- Camp ----------
describe(`camp de repos`, () => {
  it(`propose de se reposer (30 %) ou trois améliorations de sort différentes`, () => {
    const run = runAvec();
    const { soinPct, ameliorations } = optionsCamp(run, rngGraine(4));
    expect(soinPct).toBe(0.3);
    expect(ameliorations.length).toBe(3);
    const cles = ameliorations.map((choix) => `${choix.heros}:${choix.sort}`);
    expect(new Set(cles).size).toBe(3);
    for (const choix of ameliorations) {
      expect(choix.type).toBe(`sort`);
      expect(SORTS[choix.sort]).toBeTruthy();
    }
  });
  it(`le repos rend 30 % des PV max, sans dépasser le maximum`, () => {
    const run = runAvec();
    const [a, b] = run.persos;
    a.pvActuels = 1;
    b.pvActuels = pvMaxPerso(b);
    const gain = reposCamp(run);
    expect(a.pvActuels).toBe(1 + Math.round(pvMaxPerso(a) * 0.3));
    expect(b.pvActuels).toBe(pvMaxPerso(b));
    expect(gain).toBe(a.pvActuels - 1);
  });
});

// ---------- Coffre ----------
describe(`coffre`, () => {
  it(`garde le contenu tiré avec la carte ; un crocheteur désamorce le piège`, () => {
    const noeud = { type: `coffre`, tresor: `relique`, piege: `combat` };
    expect(contenuCoffre(noeud, () => 0.99)).toEqual({ tresor: `relique`, piege: `combat` });
    expect(contenuCoffre(noeud, () => 0.99, { crocheteur: true })).toEqual({
      tresor: `relique`,
      piege: null,
    });
    // ancienne carte ou zaap : tiré sur place
    expect(contenuCoffre(null, () => 0)).toEqual({ tresor: `relique`, piege: `combat` });
    expect(contenuCoffre({}, () => 0.99)).toEqual({ tresor: `objet`, piege: null });
  });
  it(`crocheteur : Sram, Roublard ou Ecaflip debout`, () => {
    expect(peutCrocheterCoffre(runAvec([`iop`, `cra`]))).toBe(false);
    const run = runAvec([`iop`, `sram`]);
    expect(peutCrocheterCoffre(run)).toBe(true);
    run.persos[1].pvActuels = 0;
    expect(peutCrocheterCoffre(run)).toBe(false);
  });
  it(`le piège à aiguilles retire 20 % des PV max sans faire tomber`, () => {
    const run = runAvec();
    const [a, b] = run.persos;
    a.pvActuels = 3;
    b.pvActuels = pvMaxPerso(b);
    piegePv(run);
    expect(a.pvActuels).toBe(1);
    expect(b.pvActuels).toBe(pvMaxPerso(b) - Math.round(pvMaxPerso(b) * 0.2));
  });
  it(`la relique d'un coffre est une relique pas encore prise ; null quand tout est pris`, () => {
    const run = runAvec();
    const choix = reliqueDeCoffre(run, rngGraine(2));
    expect(RELIQUES_RUN[choix.id]).toBeTruthy();
    run.reliquesRun = Object.keys(RELIQUES_RUN);
    expect(reliqueDeCoffre(run, rngGraine(2))).toBe(null);
  });
});

// ---------- Reliques hors combat ----------
describe(`reliques de run : colporteur, autel de sang, taverne`, () => {
  const parRarete = (rarete) => Object.values(RELIQUES_RUN).find((r) => r.rarete === rarete).id;
  it(`le prix dépend de la rareté et de la zone ; la taverne prend sa marge`, () => {
    const [c, r, e] = [`commun`, `rare`, `epique`].map((rarete) =>
      prixReliqueRun(parRarete(rarete), 1),
    );
    expect(c).toBeLessThan(r);
    expect(r).toBeLessThan(e);
    expect(prixReliqueRun(parRarete(`commun`), 10)).toBeGreaterThan(c);
    const vente = reliqueTaverne(runAvec(), rngGraine(1), 1);
    expect(vente.prix).toBe(prixReliqueRun(vente.id, 1, MARGE_TAVERNE));
    expect(vente.prix).toBeGreaterThan(prixReliqueRun(vente.id, 1));
  });
  it(`le colporteur propose 3 reliques différentes non possédées ; une seule s'achète`, () => {
    const run = runAvec([`iop`, `cra`], { reliquesRun: [`rr_laine_bouftou`] });
    const ids = reliquesProposees(run, rngGraine(5), 3);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain(`rr_laine_bouftou`);
    run.kamas = 0;
    expect(acheterReliqueRun(run, ids[0], 50)).toBe(false);
    run.kamas = 100;
    expect(acheterReliqueRun(run, ids[0], 60)).toBe(true);
    expect(run.kamas).toBe(40);
    expect(run.reliquesRun).toContain(ids[0]);
    // déjà possédée : refusée
    expect(acheterReliqueRun(run, ids[0], 1)).toBe(false);
  });
  it(`l'autel de sang donne une relique contre 8 % de PV max en combat, plafonné à 40 %`, () => {
    const run = runAvec();
    const sans = combattantsEquipe(run);
    appliquerBonusDofus(sans, bonusEquipeRun({ dofus: [] }, run));
    expect(pacteAutel(run, `rr_plume_tofu`)).toBe(true);
    expect(run.sacrificePv).toBe(SACRIFICE_AUTEL);
    const avec = combattantsEquipe(run);
    appliquerBonusDofus(avec, bonusEquipeRun({ dofus: [] }, run));
    expect(avec[0].pvMax).toBe(sans[0].pvMax - Math.round(sans[0].pvMax * 0.08));
    expect(avec[0].pvActuels).toBeLessThanOrEqual(avec[0].pvMax);
    expect(avec[0].pvActuels).toBeGreaterThan(0);
    // un héros à 1 PV reste debout
    run.persos[0].pvActuels = 1;
    const bas = combattantsEquipe(run);
    appliquerBonusDofus(bas, bonusEquipeRun({ dofus: [] }, run));
    expect(bas[0].pvActuels).toBe(1);
    // plafond
    const libres = Object.keys(RELIQUES_RUN).filter((id) => id !== `rr_plume_tofu`);
    let pris = 1;
    for (const id of libres) {
      pris += pacteAutel(run, id) ? 1 : 0;
    }
    expect(pris).toBe(5);
    expect(sacrificePvRun(run)).toBeCloseTo(0.4);
    expect(rencontresExclues(run)).toContain(`autel_sang`);
    expect(effetsEnCours(run, null).some((effet) => effet.nom.startsWith(`Pacte de sang`))).toBe(
      true,
    );
  });
  it(`plus de relique libre : ni colporteur ni autel`, () => {
    const run = runAvec([`iop`, `cra`], { reliquesRun: Object.keys(RELIQUES_RUN) });
    expect(rencontresExclues(run)).toEqual(expect.arrayContaining([`colporteur`, `autel_sang`]));
    expect(rencontresExclues(runAvec())).not.toContain(`colporteur`);
  });
  it(`sauvegarde : sacrificePv absent = 0, absurde = borné`, () => {
    expect(assainirRecompensesRun({ persos: [] }).sacrificePv).toBe(0);
    expect(assainirRecompensesRun({ persos: [], sacrificePv: 9 }).sacrificePv).toBe(0.4);
    expect(assainirRecompensesRun({ persos: [], sacrificePv: `x` }).sacrificePv).toBe(0);
  });
});

// ---------- Synergies ----------
describe(`synergies de reliques`, () => {
  it(`3 à 5 synergies, chacune entre reliques existantes, avec un effet`, () => {
    const liste = Object.values(SYNERGIES_RUN);
    expect(liste.length).toBeGreaterThanOrEqual(3);
    expect(liste.length).toBeLessThanOrEqual(5);
    for (const synergie of liste) {
      expect(synergie.reliques.length).toBe(2);
      for (const id of synergie.reliques) {
        expect(RELIQUES_RUN[id]).toBeTruthy();
      }
      expect(Object.keys(synergie.effet).length).toBeGreaterThan(0);
      expect(synergie.desc.length).toBeGreaterThan(10);
    }
  });
  it(`Venin d'Arakne + Crocs de Milimulou : les poisons durent 1 tour de plus encore`, () => {
    const seul = runAvec([`sadida`], { reliquesRun: [`rr_venin_arakne`] });
    expect(effetsReliquesRun(seul).poisonDureePlus).toBe(1);
    expect(synergiesActives(seul)).toEqual([]);
    const duo = runAvec([`sadida`], { reliquesRun: [`rr_venin_arakne`, `rr_crocs_milimulou`] });
    expect(synergiesActives(duo).map((synergie) => synergie.id)).toEqual([`syn_curee`]);
    expect(effetsReliquesRun(duo).poisonDureePlus).toBe(2);
    expect(effetsReliquesRun(duo).degatsAchevement).toBeCloseTo(0.3);
    // dans le moteur : le poison de Sève paralysante dure 3 + 2 tours
    const [sadi] = combattantsEquipe(duo);
    const m = monstresDuCombat(`abr_1`)[0];
    m.ref = `m_0`;
    m.position = 0;
    m.pvBase = m.pvMax = m.pvActuels = 100000;
    lancerSort(sadi, SORTS.seve_paralysante, m.ref, [sadi, m], {
      rng: () => 0.99,
      log: () => {},
      playerDamageBonus: 1,
      enemyDamageBonus: 1,
    });
    expect(m.effets.find((effet) => effet.stat === `poison`).toursRestants).toBe(5);
  });
  it(`annoncée dans la description, visible quand elle est active`, () => {
    expect(texteSynergies(`rr_venin_arakne`)).toMatch(/Curée.*Crocs de Milimulou/);
    const moitie = runAvec([`iop`, `cra`], { reliquesRun: [`rr_crocs_milimulou`] });
    // la carte de récompense annonce que la synergie s'active si on prend la relique
    const carte = decrireChoix({ type: `relique`, id: `rr_venin_arakne` }, moitie);
    expect(carte.effet).toMatch(/Synergie .*Curée.*active si tu la prends/);
    const duo = runAvec([`iop`, `cra`], {
      reliquesRun: [`rr_venin_arakne`, `rr_crocs_milimulou`],
    });
    const affichees = reliquesRunAffichees(duo);
    expect(affichees.length).toBe(3);
    expect(affichees.at(-1)).toMatchObject({ nom: `Curée`, synergie: true, reliqueRun: true });
    expect(affichees[0].desc).toMatch(/\(active\)/);
  });
});

describe(`rétrocompatibilité des sauvegardes`, () => {
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
  it(`une run en cours d'avant la 1.8.0 (carte sans camp ni coffre) se recharge telle quelle`, async () => {
    const run = runAvec();
    const zone = zonesDuMonde(getMonde(`t1`))[1];
    const carte = genererCarte(rngGraine(9), zone.pools, [`camp`, `coffre`]);
    expect(carte.noeuds.some((noeud) => [`camp`, `coffre`].includes(noeud.type))).toBe(false);
    run.carte = carte;
    delete run.sacrificePv;
    localStorage.setItem(`rld_run_v0`, JSON.stringify({ version: 2, zoneIdx: 1, run }));
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const charge = chargerRun();
    expect(charge.run.carte).toEqual(carte);
    expect(charge.run.sacrificePv).toBe(0);
    expect(noeudsAtteignables(charge.run.carte).length).toBe(2);
  });
});
