import { describe, expect, it } from "vitest";
import { comparerObjet, grouperInventaire } from "../src/jeu/inventaire.js";
import { annulerVente, prixRevente, vendreObjet } from "../src/jeu/economie.js";
import { instancierObjet, nouvelleRun } from "../src/jeu/run.js";
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
  it(`« Équiper le meilleur » équipe un « plutôt mieux », pas un « plutôt moins »`, async () => {
    const { equiperMeilleur, herosAmeliorablesAuto } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20 });
    const perte = cape({ intelligence: 10, soin: 1 });
    const gain = cape({ intelligence: 18, crit: 5 });
    run.inventaire.push(perte);
    expect(herosAmeliorablesAuto(perte, run.persos)).toEqual([]);
    expect(equiperMeilleur(run)).toBe(0);
    run.inventaire.push(gain);
    expect(herosAmeliorablesAuto(gain, run.persos).length).toBe(1);
    expect(equiperMeilleur(run)).toBe(1);
    expect(run.persos[0].equipement.cape).toBe(gain);
    expect(equiperMeilleur(run)).toBe(0);
  });
  it(`un PA pèse plus que n'importe quelle pile de Vitalité, et les dégâts plus que les PV`, async () => {
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = runAvecCape({ intelligence: 20, vitalite: 40 });
    const avecPA = { ...cape({ intelligence: 12, vitalite: 10 }), pa: 1 };
    const grosPV = cape({ intelligence: 19, vitalite: 90 });
    run.inventaire.push(grosPV);
    expect(equiperMeilleur(run)).toBe(0); // beaucoup de PV ne vaut pas 1 point de dégâts perdu
    run.inventaire.push(avecPA);
    expect(equiperMeilleur(run)).toBe(1);
    expect(run.persos[0].equipement.cape).toBe(avecPA);
    const degats = cape({ intelligence: 30, vitalite: 0 });
    run.inventaire.push(degats);
    expect(equiperMeilleur(run)).toBe(0); // perdre le PA pour +18 dégâts : non
  });
  it(`une pièce de panoplie qui rapproche d'un palier à PA est préférée à une pièce banale`, async () => {
    const { PANOPLIES } = await import(`../src/data/index.js`);
    const { valeurEquipement } = await import(`../src/jeu/inventaire.js`);
    const nom = Object.keys(PANOPLIES).find((n) => {
      const p = PANOPLIES[n];
      return p.pieces.length >= 3 && p.paliers[3]?.pa && !p.paliers[2]?.pa;
    });
    expect(nom).toBeTruthy();
    const run = nouvelleRun([`iop`]);
    const perso = run.persos[0];
    const piece = objet(PANOPLIES[nom].pieces[0], `epique`);
    const avant = valeurEquipement(perso);
    perso.equipement[EQUIPEMENTS[piece.id].slot === `arme` ? `arme` : EQUIPEMENTS[piece.id].slot] =
      { ...piece, stats: {}, adaptatif: 0, pa: 0 };
    expect(valeurEquipement(perso)).toBeGreaterThan(avant + 20);
  });
  it(`un objet meilleur en stats mais qui éloigne d'un palier de panoplie à PA n'est ni équipé ni signalé « sûr »`, async () => {
    const { PANOPLIES } = await import(`../src/data/index.js`);
    const { equiperMeilleur } = await import(`../src/jeu/inventaire.js`);
    const run = nouvelleRun([`eniripsa`]);
    const perso = run.persos[0];
    // 5 pièces de la panoplie du Bouftou (le +1 PA est au palier de 7 pièces)
    const pieces = PANOPLIES[`Panoplie du Bouftou`].pieces.slice(0, 5);
    for (const id of pieces) {
      perso.equipement[EQUIPEMENTS[id].slot === `anneau` ? `anneau` : EQUIPEMENTS[id].slot] = objet(
        id,
        `epique`,
      );
    }
    // une amulette banale ne remplace que l'amulette du Bouftou : meilleure en PV, mais la panoplie
    // passerait de 5 à 4 pièces
    const inst = objet(`amulette_de_logram`, `epique`);
    const c = comparerObjet(inst, perso);
    expect(c.verdict).toBe(`mieux`);
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
