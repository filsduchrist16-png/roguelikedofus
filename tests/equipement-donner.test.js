// Équipement : donner ou échanger un objet porté avec un autre héros, en un geste (1.9.0).
import { describe, expect, it } from "vitest";
import { EQUIPEMENTS } from "../src/data/index.js";
import { instancierObjet, nouvelleRun, pvMaxPerso } from "../src/jeu/run.js";
import { donnerObjet } from "../src/ui/ecrans/equipement.js";

const objet = (slot, sauf = []) => {
  const [id, def] = Object.entries(EQUIPEMENTS).find(
    ([cle, candidat]) =>
      candidat.slot === slot && !candidat.ligneAvant && !candidat.panoplie && !sauf.includes(cle),
  );
  return instancierObjet(id, Object.keys(def.tiers)[0]);
};
const runVide = () => {
  const run = nouvelleRun([`iop`, `cra`]);
  for (const perso of run.persos) {
    perso.equipement = {};
  }
  run.inventaire = [];
  return run;
};

describe(`donnerObjet`, () => {
  it(`emplacement vide chez l'autre : l'objet passe, rien en retour`, () => {
    const run = runVide();
    const [iop, cra] = run.persos;
    const cape = objet(`cape`);
    iop.equipement.cape = cape;
    const resultat = donnerObjet(run.inventaire, iop, `cape`, cra);
    expect(resultat).toEqual({ inst: cape, ancien: undefined, echange: false });
    expect(cra.equipement.cape).toBe(cape);
    expect(iop.equipement.cape).toBeUndefined();
    expect(run.inventaire).toEqual([]);
  });
  it(`l'autre porte déjà un objet : les deux héros échangent`, () => {
    const run = runVide();
    const [iop, cra] = run.persos;
    const a = objet(`cape`);
    const b = objet(`cape`, [a.id]);
    iop.equipement.cape = a;
    cra.equipement.cape = b;
    const resultat = donnerObjet(run.inventaire, iop, `cape`, cra);
    expect(resultat.echange).toBe(true);
    expect(cra.equipement.cape).toBe(a);
    expect(iop.equipement.cape).toBe(b);
    expect(run.inventaire).toEqual([]);
  });
  it(`objet de ligne avant vers un héros de ligne arrière : refusé, rien ne bouge`, () => {
    const run = runVide();
    const [iop, cra] = run.persos;
    const entree = Object.entries(EQUIPEMENTS).find(([, def]) => def.ligneAvant);
    if (!entree) {
      return;
    }
    const inst = instancierObjet(entree[0], Object.keys(entree[1].tiers)[0]);
    iop.equipement[entree[1].slot === `anneau` ? `anneau1` : entree[1].slot] = inst;
    cra.position = 5;
    const emplacement = Object.keys(iop.equipement)[0];
    expect(donnerObjet(run.inventaire, iop, emplacement, cra)).toBe(null);
    expect(iop.equipement[emplacement]).toBe(inst);
  });
  it(`les PV restent sous le maximum après l'échange`, () => {
    const run = runVide();
    const [iop, cra] = run.persos;
    iop.equipement.cape = objet(`cape`);
    iop.pvActuels = pvMaxPerso(iop);
    donnerObjet(run.inventaire, iop, `cape`, cra);
    expect(iop.pvActuels).toBeLessThanOrEqual(pvMaxPerso(iop));
  });
});
