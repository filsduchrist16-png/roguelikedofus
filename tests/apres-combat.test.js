// Écran unique butin + récompense après un combat (1.9.0) : tout est rangé dans la run et la case
// marquée visitée avant l'écran, la run sauvegardée ; un rechargement remontre le même écran sans
// rejouer le combat ni relancer le tirage.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nouvelleRun, instancierObjet } from "../src/jeu/run.js";
import { EQUIPEMENTS } from "../src/data/index.js";

function stockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}
// Page minimale : les modules d'écran s'importent sans navigateur.
function pageMinimale() {
  const element = () => ({
    style: {},
    children: [],
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {},
    removeAttribute() {},
    appendChild() {},
    addEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  });
  globalThis.document = {
    visibilityState: `visible`,
    addEventListener() {},
    removeEventListener() {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: element,
    body: element(),
    documentElement: element(),
  };
  globalThis.window = globalThis;
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
  globalThis.history = { pushState() {}, replaceState() {} };
}
const objetDe = (id) => {
  const def = EQUIPEMENTS[id];
  return instancierObjet(id, Object.keys(def.tiers)[0]);
};
const premierObjet = () => Object.keys(EQUIPEMENTS).find((id) => !EQUIPEMENTS[id].secret);

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock(`../src/ui/ecrans/carte.js`);
  vi.doUnmock(`../src/deroule/combat.js`);
  vi.doUnmock(`../src/ui/ecrans/apresCombat.js`);
  vi.doUnmock(`../src/ui/ecrans/rencontre.js`);
  vi.doUnmock(`../src/ui/ecrans/message.js`);
  vi.doUnmock(`../src/ui/ecrans/butin.js`);
  globalThis.localStorage = stockage();
});

describe(`butin en attente : lecture tolérante`, () => {
  it(`absent ou abîmé : rien en attente ; objets inconnus retirés`, async () => {
    const { assainirButinCombat } = await import(`../src/sauvegarde/run.js`);
    expect(assainirButinCombat(undefined)).toBe(null);
    expect(assainirButinCombat(`x`)).toBe(null);
    expect(assainirButinCombat([])).toBe(null);
    const id = premierObjet();
    const lu = assainirButinCombat({
      objets: [{ id: `bidon` }, objetDe(id), null],
      bilan: 42,
      cle: `oui`,
    });
    expect(lu.objets.map((objet) => objet.id)).toEqual([id]);
    expect(lu.bilan).toBe(``);
    expect(lu.cle).toBe(false);
  });
  it(`après un rechargement, les objets du butin redeviennent ceux de l'inventaire`, async () => {
    const { sauverRun, chargerRun } = await import(`../src/sauvegarde/run.js`);
    const run = nouvelleRun([`iop`, `cra`]);
    const id = premierObjet();
    const a = objetDe(id);
    const b = objetDe(id);
    run.inventaire.push(a, b);
    run.butinCombat = { objets: [a, b], bilan: `+10 XP`, cle: true };
    sauverRun(0, run);
    const charge = chargerRun().run;
    expect(charge.butinCombat.bilan).toBe(`+10 XP`);
    expect(charge.butinCombat.cle).toBe(true);
    expect(charge.butinCombat.objets).toHaveLength(2);
    // mêmes objets (identité) que ceux de l'inventaire, chacun une seule fois
    expect(charge.butinCombat.objets[0]).toBe(charge.inventaire[0]);
    expect(charge.butinCombat.objets[1]).toBe(charge.inventaire[1]);
  });
  it(`un objet déjà équipé est retrouvé sur le héros`, async () => {
    const { relierButin } = await import(`../src/sauvegarde/run.js`);
    const run = nouvelleRun([`iop`, `cra`]);
    const porte = Object.values(run.persos[0].equipement).find(Boolean);
    if (!porte) {
      return;
    }
    const copie = structuredClone(porte);
    expect(relierButin(run, [copie])[0]).toBe(porte);
  });
});

describe(`ordre des sauvegardes après un combat`, () => {
  async function preparer({ reponse = 0, carteSeule = false } = {}) {
    pageMinimale();
    const vus = [];
    const ordre = [];
    let appelsCarte = 0;
    let combats = 0;
    vi.doMock(`../src/ui/ecrans/carte.js`, async (original) => ({
      ...(await original()),
      ecranCarte: async (carte) => {
        appelsCarte += 1;
        ordre.push(`carte`);
        if (appelsCarte > 1 || carteSeule) {
          return `accueil`;
        }
        // premier combat atteignable
        const depart = carte.noeuds.find(
          (noeud) => noeud.type === `combat` && carte.noeuds[0] && noeud.rangee === 0,
        );
        return depart ?? carte.noeuds.find((noeud) => noeud.type === `combat`);
      },
    }));
    vi.doMock(`../src/deroule/combat.js`, async (original) => ({
      ...(await original()),
      jouerCombat: async () => {
        combats += 1;
        return { gagne: true, defiOk: false, prime: false };
      },
    }));
    vi.doMock(`../src/ui/ecrans/apresCombat.js`, () => ({
      ecranApresCombat: async (butin, offre) => {
        // ce que contient la sauvegarde au moment où l'écran s'affiche
        const sauvegarde = JSON.parse(localStorage.getItem(`rld_run_v0`));
        vus.push({ butin, offre, sauvegarde });
        ordre.push(`ecran`);
        return reponse;
      },
    }));
    const { jouerZone } = await import(`../src/deroule/zone.js`);
    const { zonesDuMonde, getMonde } = await import(`../src/jeu/config.js`);
    const zone = zonesDuMonde(getMonde(`t1`))[0];
    const run = nouvelleRun([`iop`, `cra`]);
    return { jouerZone, zone, run, vus, ordre, combats: () => combats };
  }

  it(`case visitée, butin et offre sauvegardés avant l'écran ; tout est vidé après`, async () => {
    const { jouerZone, zone, run, vus, combats } = await preparer();
    expect(await jouerZone(run, zone, 0)).toBe(`accueil`);
    expect(combats()).toBe(1);
    expect(vus).toHaveLength(1);
    const { sauvegarde, offre } = vus[0];
    const courant = sauvegarde.run.carte.courant;
    const noeud = sauvegarde.run.carte.noeuds.find((candidat) => candidat.id === courant);
    expect(noeud?.visite).toBe(true);
    expect(sauvegarde.run.offreCombat).toEqual(offre);
    expect(offre.choix).toHaveLength(3);
    expect(sauvegarde.run.butinCombat).toBeTruthy();
    expect(typeof sauvegarde.run.butinCombat.bilan).toBe(`string`);
    // après le choix : plus rien en attente dans la sauvegarde
    const finale = JSON.parse(localStorage.getItem(`rld_run_v0`));
    expect(finale.run.offreCombat).toBe(null);
    expect(finale.run.butinCombat).toBe(null);
  });

  it(`un rechargement pendant l'écran remontre le même écran sans rejouer le combat`, async () => {
    const premier = await preparer();
    await premier.jouerZone(premier.run, premier.zone, 0);
    const pendant = premier.vus[0].sauvegarde;
    // on recharge la page avec la sauvegarde prise pendant l'écran
    vi.resetModules();
    globalThis.localStorage = stockage();
    localStorage.setItem(`rld_run_v0`, JSON.stringify(pendant));
    const second = await preparer({ carteSeule: true });
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const repris = chargerRun();
    await second.jouerZone(repris.run, second.zone, repris.zoneIdx);
    expect(second.combats()).toBe(0);
    // l'écran revient d'abord, puis la carte (où la case est déjà visitée)
    expect(second.ordre).toEqual([`ecran`, `carte`]);
    expect(second.vus).toHaveLength(1);
    expect(second.vus[0].offre).toEqual(premier.vus[0].offre);
    expect(second.vus[0].butin.bilan).toBe(premier.vus[0].butin.bilan);
    expect(second.vus[0].butin.objets.map((objet) => objet.id)).toEqual(
      premier.vus[0].butin.objets.map((objet) => objet.id),
    );
  });

  it(`« Passer » ajoute les kamas de l'offre et vide l'attente`, async () => {
    const { jouerZone, zone, run, vus } = await preparer({ reponse: `passer` });
    await jouerZone(run, zone, 0);
    const avant = vus[0].sauvegarde.run.kamas;
    const finale = JSON.parse(localStorage.getItem(`rld_run_v0`));
    expect(finale.run.kamas).toBe(avant + vus[0].offre.passer);
  });
});

describe(`camp et rencontres : même choix après un rechargement`, () => {
  async function jouerCase(type, sauvegarde) {
    vi.resetModules();
    pageMinimale();
    const vus = [];
    vi.doMock(`../src/ui/ecrans/rencontre.js`, () => ({
      ecranRencontre: async (options) => {
        vus.push({
          titre: options.titre,
          choix: options.choix.map((choix) => `${choix.libelle} | ${choix.detail ?? ``}`),
          sauvegarde: JSON.parse(localStorage.getItem(`rld_run_v0`)),
        });
        // on part sans rien prendre quand c'est possible, sinon la première option
        const partir = options.choix.find((choix) => /^(partir|garder|soin|repos)$/.test(choix.id));
        return (partir ?? options.choix.find((choix) => !choix.desactive) ?? options.choix[0]).id;
      },
    }));
    vi.doMock(`../src/ui/ecrans/message.js`, () => ({ ecranMessage: async () => {} }));
    vi.doMock(`../src/ui/ecrans/butin.js`, () => ({ ecranButin: async () => {} }));
    const { resoudreNoeud } = await import(`../src/deroule/noeud.js`);
    const { etatRun } = await import(`../src/deroule/etat.js`);
    const { chargerRun } = await import(`../src/sauvegarde/run.js`);
    const { zonesDuMonde, getMonde } = await import(`../src/jeu/config.js`);
    const zone = zonesDuMonde(getMonde(`t1`))[1];
    let run;
    if (sauvegarde) {
      localStorage.setItem(`rld_run_v0`, JSON.stringify(sauvegarde));
      run = chargerRun().run;
    } else {
      run = nouvelleRun([`iop`, `cra`, `eniripsa`]);
    }
    etatRun.active = { zoneIdx: 1, run };
    await resoudreNoeud(run, type, null, 0, zone, undefined, { id: 7, type });
    return { vus, run };
  }
  for (const type of [`camp`, `rencontre`]) {
    it(`${type} : la run est sauvegardée avec la graine avant l'écran, le choix revient pareil`, async () => {
      const essais = new Set();
      for (let essai = 0; essai < 4; essai++) {
        globalThis.localStorage = stockage();
        const premier = await jouerCase(type);
        expect(premier.vus.length).toBeGreaterThan(0);
        const pendant = premier.vus[0].sauvegarde;
        expect(pendant.run.graineCase?.cle).toBe(`1:7:${type}`);
        // après la case, plus de graine en attente
        expect(premier.run.graineCase).toBe(null);
        const second = await jouerCase(type, pendant);
        expect(second.vus[0].titre).toBe(premier.vus[0].titre);
        expect(second.vus[0].choix).toEqual(premier.vus[0].choix);
        essais.add(JSON.stringify(premier.vus[0].choix));
      }
      // la graine change d'une case à l'autre : les tirages ne sont pas figés
      if (type === `rencontre`) {
        expect(essais.size).toBeGreaterThan(1);
      }
    });
  }
});
