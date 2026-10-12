import { describe, expect, it } from "vitest";
import { comparerObjet, grouperInventaire } from "../src/jeu/inventaire.js";
import { annulerVente, prixRevente, vendreObjet } from "../src/jeu/economie.js";
import { bonusEquipement, instancierObjet, nouvelleRun } from "../src/jeu/run.js";
import { EQUIPEMENTS } from "../src/data/index.js";

const premierTier = (id) => Object.keys(EQUIPEMENTS[id].tiers)[0];
const objet = (id, rarete = premierTier(id)) => instancierObjet(id, rarete);

describe(`comparaison d'objets`, () => {
  it(`un objet sur un emplacement vide n'ayant que des gains est une amélioration`, () => {
    const run = nouvelleRun([`iop`, `cra`]);
    const id = Object.keys(EQUIPEMENTS).find((k) => {
      const t = EQUIPEMENTS[k].tiers[premierTier(k)];
      return (
        !t.adaptatif &&
        Object.values(t.stats ?? {}).every((v) => v > 0) &&
        !t.resistances &&
        Object.keys(EQUIPEMENTS[k]).length <= 5
      );
    });
    expect(comparerObjet(objet(id), run.persos[0]).verdict).toBe(`mieux`);
  });
  it(`un objet comparé à lui-même ne change rien`, () => {
    const run = nouvelleRun([`iop`]);
    const p = run.persos[0];
    const inst = objet(`abracape`, `epique`);
    p.equipement.cape = inst;
    const c = comparerObjet({ ...inst }, p);
    expect(c.deltas).toEqual([]);
    expect(c.verdict).toBe(`egal`);
  });
  it(`la Force est jugée inutile pour une classe qui ne frappe pas en Terre`, () => {
    const run = nouvelleRun([`cra`]);
    const inst = { ...objet(`abracape`, `epique`), adaptatif: 0, stats: { force: 10 } };
    const d = comparerObjet(inst, run.persos[0]).deltas.find((x) => x.cle === `force`);
    expect(d?.utile).toBe(false);
  });
});

describe(`inventaire`, () => {
  it(`regroupe les exemplaires identiques`, () => {
    const inv = [
      objet(`abracape`, `epique`),
      objet(`abracape`, `legendaire`),
      objet(`abracape`, `epique`),
    ];
    const g = grouperInventaire(inv);
    expect(g.map((x) => x.indices)).toEqual([[0, 2], [1]]);
  });
  it(`une vente peut être annulée`, () => {
    const run = nouvelleRun([`iop`]);
    const inst = objet(`abracape`, `epique`);
    run.inventaire.push(inst);
    const kamas = run.kamas;
    const prix = prixRevente(inst);
    vendreObjet(run, 0);
    expect(run.kamas).toBe(kamas + prix);
    expect(annulerVente(run, inst, prix)).toBe(true);
    expect(run.kamas).toBe(kamas);
    expect(run.inventaire).toEqual([inst]);
  });
});

describe(`équiper le meilleur / vendre l'inutile`, async () => {
  const { equiperMeilleur, objetsInutiles } = await import(`../src/jeu/inventaire.js`);
  const { nouvelleRun, instancierObjet } = await import(`../src/jeu/run.js`);
  const { EQUIPEMENTS: EQ } = await import(`../src/data/index.js`);
  it(`équipe les nettes améliorations sur les emplacements vides, puis ne refait rien`, () => {
    const run = nouvelleRun([`iop`, `cra`], 0, `t1`);
    const ids = Object.values(EQ)
      .filter((o) => !o.secret && !o.retire && o.tiers.legendaire && o.slot !== `arme`)
      .slice(0, 6)
      .map((o) => o.id);
    run.inventaire.push(...ids.map((id) => instancierObjet(id, `legendaire`)));
    const n = equiperMeilleur(run);
    expect(n).toBeGreaterThan(0);
    expect(run.inventaire.length).toBe(ids.length - n);
    expect(equiperMeilleur(run)).toBe(0);
    for (const inst of objetsInutiles(run)) {
      expect(run.inventaire).toContain(inst);
    }
  });
});

describe(`comparaisons chiffrées`, async () => {
  const { objetsInutiles } = await import(`../src/jeu/inventaire.js`);
  const {
    acheterObjet,
    annulerAchat,
    annulerVentes,
    vendreObjet: vendre,
  } = await import(`../src/jeu/economie.js`);
  // une cape aux stats choisies (mêmes résistances et effets que la cape portée)
  const cape = (stats) => ({ ...objet(`abracape`, `epique`), adaptatif: 0, pa: 0, stats });
  const runAvecCape = (stats) => {
    const run = nouvelleRun([`iop`]);
    run.persos[0].equipement.cape = cape(stats);
    return run;
  };
  it(`les dégâts décident : on équipe plus de dégâts même contre des PV, jamais l'inverse`, async () => {
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20, vitalite: 40 });
    // moins de dégâts, beaucoup plus de PV : refusé
    run.inventaire.push(cape({ intelligence: 19, vitalite: 90 }));
    expect(equiperMeilleur(run)).toBe(0);
    // un peu plus de dégâts, moins de PV : équipé (les dégâts sont privilégiés)
    const plusDegats = cape({ intelligence: 24, vitalite: 30 });
    run.inventaire.push(plusDegats);
    expect(equiperMeilleur(run)).toBe(1);
    expect(run.persos[0].equipement.cape).toBe(plusDegats);
    // mais pas au prix d'une chute des PV max de plus d'un tiers
    const run2 = runAvecCape({ intelligence: 20, vitalite: 100 });
    run2.inventaire.push(cape({ intelligence: 40, vitalite: 0 }));
    expect(equiperMeilleur(run2)).toBe(0);
  });
  it(`le critique est un gain de dégâts, la survie ne sert qu'à départager`, async () => {
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20, vitalite: 10 });
    run.inventaire.push(cape({ intelligence: 20, vitalite: 30 }));
    expect(equiperMeilleur(run)).toBe(1); // à dégâts égaux, plus de survie
    const run2 = runAvecCape({ intelligence: 20, vitalite: 30 });
    run2.inventaire.push(cape({ intelligence: 18, crit: 6, vitalite: 10 }));
    expect(equiperMeilleur(run2)).toBe(1); // le critique compte comme des dégâts
  });
  it(`un PA passe avant tout, même devant un gros gain de dégâts`, async () => {
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20, vitalite: 40 });
    const avecPA = { ...cape({ intelligence: 12, vitalite: 10 }), pa: 1 };
    run.inventaire.push(avecPA);
    expect(equiperMeilleur(run)).toBe(1);
    expect(run.persos[0].equipement.cape).toBe(avecPA);
    run.inventaire.push(cape({ intelligence: 60, vitalite: 0 }));
    expect(equiperMeilleur(run)).toBe(0); // perdre le PA pour des dégâts : non
  });
  it(`une panoplie qui se complète compte comme un gain direct : ses pièces sans stats sont équipées ensemble`, async () => {
    const { PANOPLIES } = await import(`../src/data/index.js`);
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const nom = Object.keys(PANOPLIES).find((n) => {
      const p = PANOPLIES[n];
      const slots = p.pieces.slice(0, 3).map((id) => EQUIPEMENTS[id].slot);
      return p.paliers[3]?.pa && !p.paliers[2]?.pa && new Set(slots).size === 3;
    });
    expect(nom).toBeTruthy();
    const run = nouvelleRun([`iop`]);
    const trois = PANOPLIES[nom].pieces.slice(0, 3);
    run.inventaire.push(
      ...trois.map((id) => ({ ...objet(id, `epique`), stats: {}, adaptatif: 0, pa: 0 })),
    );
    expect(equiperMeilleur(run)).toBe(3);
    expect(bonusEquipement(run.persos[0]).paBonus).toBe(1);
  });
  it(`toutes les pièces d'une panoplie dans l'inventaire : on les pose ensemble pour le +1 PA, même si chacune vaut moins que l'objet porté`, async () => {
    const { PANOPLIES } = await import(`../src/data/index.js`);
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const nom = Object.keys(PANOPLIES).find((n) => {
      const p = PANOPLIES[n];
      const slots = p.pieces.slice(0, 3).map((id) => EQUIPEMENTS[id].slot);
      return (
        p.paliers[3]?.pa &&
        !p.paliers[2]?.pa &&
        new Set(slots).size === 3 &&
        !slots.includes(`arme`) &&
        !slots.includes(`anneau`)
      );
    });
    expect(nom).toBeTruthy();
    const run = nouvelleRun([`iop`]);
    const perso = run.persos[0];
    const trois = PANOPLIES[nom].pieces.slice(0, 3);
    // l'héros porte déjà des objets puissants à ces emplacements
    for (const id of trois) {
      perso.equipement[EQUIPEMENTS[id].slot] = {
        ...objet(`abracape`, `epique`),
        id: Object.values(EQUIPEMENTS).find(
          (o) => o.slot === EQUIPEMENTS[id].slot && !o.panoplie && !o.retire && o.tiers.epique,
        ).id,
        adaptatif: 30,
        pa: 0,
        stats: {},
      };
    }
    run.inventaire.push(
      ...trois.map((id) => ({ ...objet(id, `epique`), stats: {}, adaptatif: 0, pa: 0 })),
    );
    const degatsAvant = comparerObjet(run.inventaire[0], perso).offensif;
    expect(degatsAvant).toBeLessThan(0); // une pièce seule est moins bonne que l'objet porté
    expect(equiperMeilleur(run)).toBe(3);
    expect(bonusEquipement(perso).paBonus).toBe(1); // mais l'ensemble donne le PA
  });
  it(`planEquiper annonce exactement ce que fait le bouton, sans rien changer`, async () => {
    const { equiperMeilleur, planEquiper } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20 });
    run.inventaire.push(cape({ intelligence: 30 }), cape({ intelligence: 5 }));
    const avant = run.inventaire.length;
    const plan = planEquiper(run);
    expect(run.inventaire.length).toBe(avant);
    expect(equiperMeilleur(run)).toBe(plan.length);
  });
  it(`planEquiper ne reste pas périmé après la forgemagie d'un objet de l'inventaire`, async () => {
    const { planEquiper } = await import(`../src/jeu/inventaire.js`);
    const { forgerObjet } = await import(`../src/jeu/economie.js`);
    // une amulette dont le cran de forge « rare » donne de la stat adaptative
    const id = Object.keys(EQUIPEMENTS).find((k) => {
      const t = EQUIPEMENTS[k].tiers;
      return (
        EQUIPEMENTS[k].slot === `amulette` &&
        !EQUIPEMENTS[k].panoplie &&
        t.commun &&
        t.rare &&
        t.rare.adaptatif > 0
      );
    });
    expect(id).toBeTruthy();
    const vide = (inst) => ({ ...inst, stats: {}, adaptatif: 0, resistances: {}, pa: 0 });
    const run = nouvelleRun([`iop`]);
    run.persos[0].equipement.amulette = vide(objet(id, `commun`));
    const inst = vide(objet(id, `commun`));
    run.inventaire.push(inst);
    expect(planEquiper(run)).toHaveLength(0); // identique à l'amulette portée
    run.kamas = 1e9;
    expect(forgerObjet(run, inst, false, () => 1)).toBe(`forge`);
    const obtenu = planEquiper(run).length; // avant la copie : elle remplacerait le cache
    const attendu = planEquiper(JSON.parse(JSON.stringify(run))).length;
    expect(attendu).toBe(1);
    expect(obtenu).toBe(attendu);
  });
  it(`un objet qui fait perdre des dégâts (bonus de panoplie perdu) n'est pas équipé d'office`, async () => {
    const { PANOPLIES } = await import(`../src/data/index.js`);
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = nouvelleRun([`eniripsa`]);
    const perso = run.persos[0];
    const pieces = PANOPLIES[`Panoplie du Bouftou`].pieces.slice(0, 5);
    for (const id of pieces) {
      perso.equipement[EQUIPEMENTS[id].slot] = objet(id, `epique`);
    }
    // une amulette banale ne remplace que l'amulette du Bouftou : plus de PV, mais la panoplie
    // passerait de 5 à 4 pièces et perdrait son bonus
    const inst = { ...objet(`amulette_de_logram`, `epique`), adaptatif: 0, stats: { vitalite: 6 } };
    const c = comparerObjet(inst, perso);
    expect(c.offensif).toBeLessThan(0);
    expect(c.sure).toBe(false);
    run.inventaire.push(inst);
    expect(equiperMeilleur(run)).toBe(0);
  });
  it(`un mitigé à score négatif pour tous est inutile, pas un mitigé à score positif`, () => {
    const run = runAvecCape({ intelligence: 20 });
    const perte = cape({ intelligence: 10, soin: 1 });
    const gain = cape({ intelligence: 18, crit: 5 });
    const cp = comparerObjet(perte, run.persos[0]);
    const cg = comparerObjet(gain, run.persos[0]);
    expect(cp.verdict).toBe(`mitige`);
    expect(cp.score).toBeLessThan(0);
    expect(cp.tendance).toBe(`moins`);
    expect(cg.verdict).toBe(`mitige`);
    expect(cg.score).toBeGreaterThan(0);
    expect(cg.tendance).toBe(`plus`);
    run.inventaire.push(perte, gain);
    expect(objetsInutiles(run)).toEqual([perte]);
  });
  it(`les effets spéciaux gagnés ou perdus figurent dans les deltas`, () => {
    const run = nouvelleRun([`iop`]);
    const p = run.persos[0];
    const id = Object.keys(EQUIPEMENTS).find((k) => EQUIPEMENTS[k].riposteAvant);
    const inst = objet(id);
    p.equipement = {};
    const c = comparerObjet(inst, p);
    expect(c.deltas).toContainEqual({ cle: `effet_riposteAvant`, valeur: 1, utile: true });
    p.equipement[c.emplacement] = inst;
    const sans = Object.keys(EQUIPEMENTS).find(
      (k) =>
        EQUIPEMENTS[k].slot === EQUIPEMENTS[id].slot &&
        !EQUIPEMENTS[k].riposteAvant &&
        !EQUIPEMENTS[k].ligneAvant,
    );
    const c2 = comparerObjet(objet(sans), p);
    expect(c2.deltas).toContainEqual({ cle: `effet_riposteAvant`, valeur: -1, utile: true });
  });
  it(`un achat est annulable : remboursé et remis à sa place dans le stock`, () => {
    const run = nouvelleRun([`iop`]);
    run.kamas = 1000;
    const stock = [
      { inst: cape({ force: 1 }), prix: 100 },
      { inst: cape({ force: 2 }), prix: 200 },
      { inst: cape({ force: 3 }), prix: 300 },
    ];
    const achete = stock[1];
    expect(acheterObjet(run, stock, 1)).toBe(true);
    expect(run.kamas).toBe(800);
    expect(annulerAchat(run, stock, achete.inst, achete.prix, 1)).toBe(true);
    expect(run.kamas).toBe(1000);
    expect(run.inventaire).toEqual([]);
    expect(stock.map((x) => x.prix)).toEqual([100, 200, 300]);
    // déjà sorti de l'inventaire (équipé) : rien n'est fait
    expect(annulerAchat(run, stock, achete.inst, achete.prix, 1)).toBe(false);
  });
  it(`un lot vendu s'annule d'un bloc`, () => {
    const run = nouvelleRun([`iop`]);
    const a = cape({ force: 1 });
    const b = cape({ force: 2 });
    run.inventaire.push(a, b);
    const kamas = run.kamas;
    const ventes = [a, b].map((inst) => ({ inst, prix: prixRevente(inst) }));
    vendre(run, 0);
    vendre(run, 0);
    expect(annulerVentes(run, ventes)).toBe(true);
    expect(run.kamas).toBe(kamas);
    expect(run.inventaire).toEqual([a, b]);
  });
});
