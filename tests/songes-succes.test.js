// Songes infinis : les trois succès d'étage et leur récompense (kamas de départ).
import { describe, expect, it } from "vitest";
import { SUCCES } from "../src/data/index.js";
import {
  contexteMeta,
  etatQuete,
  nouvelEtatQuetes,
  verifierQuetesMeta,
} from "../src/jeu/quetes.js";
import { decrireQuete } from "../src/jeu/obtention.js";
import { CONFIG_SONGES, kamasDepartSonges } from "../src/jeu/songes.js";

const metaAvecRecord = (score) => ({
  archis: [],
  collection: {},
  dofus: [],
  runs: 0,
  ascension: {},
  reliques: [],
  records: score ? { songes: { score, idoles: [], ascension: 0 } } : {},
});

describe(`succès des Songes infinis`, () => {
  const succes = SUCCES.songes_infinis;
  it(`trois nouvelles quêtes : étages 10, 25 et 50`, () => {
    expect(succes.quetes.map((q) => q.id)).toEqual([
      `songes_etage_10`,
      `songes_etage_25`,
      `songes_etage_50`,
    ]);
    expect(succes.categorie.dofus).toBeUndefined();
    expect(succes.recompense).toMatch(/kamas/);
    for (const quete of succes.quetes) {
      expect(decrireQuete(quete).lignes.length).toBeGreaterThan(0);
    }
  });
  it(`validées selon le record d'étages franchis`, () => {
    const etat = nouvelEtatQuetes();
    expect(verifierQuetesMeta(etat, contexteMeta(metaAvecRecord(9))).quetes).toEqual([]);
    const ids = verifierQuetesMeta(etat, contexteMeta(metaAvecRecord(26))).quetes.map((q) => q.id);
    expect(ids).toContain(`songes_etage_10`);
    expect(ids).toContain(`songes_etage_25`);
    expect(ids).not.toContain(`songes_etage_50`);
    expect(etatQuete(etat, succes.quetes[2], contexteMeta(metaAvecRecord(26))).compteur).toEqual([
      26, 50,
    ]);
  });
  it(`récompense : des kamas de départ par quête terminée`, () => {
    expect(kamasDepartSonges({ quetes: nouvelEtatQuetes() })).toBe(0);
    expect(kamasDepartSonges({ quetes: { faites: [`songes_etage_10`, `songes_etage_25`] } })).toBe(
      2 * CONFIG_SONGES.kamasParQuete,
    );
  });
});
