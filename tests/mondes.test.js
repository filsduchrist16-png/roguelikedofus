import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMBATS, MONDES, MONSTRES, RELIQUES, SUCCES, ZONES } from "../src/data/index.js";
import { nouvelEtatQuetes, verifierQuetesCombat } from "../src/jeu/quetes.js";

const img = (chemin) => existsSync(`public${chemin}`);

describe(`mondes 3 à 5`, () => {
  for (const id of [`t3`, `t4`, `t5`]) {
    const monde = MONDES.find((m) => m.id === id);
    it(`${monde.nom} a 12 zones complètes`, () => {
      expect(monde.zones).toHaveLength(12);
      for (const zid of monde.zones) {
        const zone = ZONES.find((z) => z.id === zid);
        expect(zone?.pools, zid).toBeTruthy();
        expect(zone.pools.normales.length, zid).toBe(3);
        expect(zone.pools.elite.length, zid).toBe(1);
        expect(zone.pools.boss.length, zid).toBeGreaterThan(0);
        for (const cid of [...zone.pools.normales, ...zone.pools.elite, ...zone.pools.boss]) {
          for (const { monstre } of COMBATS[cid].ennemis) {
            expect(MONSTRES[monstre], `${cid} → ${monstre}`).toBeTruthy();
            expect(img(MONSTRES[monstre].img), MONSTRES[monstre].img).toBe(true);
          }
        }
        const bosses = zone.pools.boss.flatMap((c) =>
          COMBATS[c].ennemis.map((e) => MONSTRES[e.monstre]),
        );
        expect(
          bosses.some((m) => m.boss),
          zid,
        ).toBe(true);
      }
    });
  }

  it(`chaque succès de boss vise un boss présent dans un donjon`, () => {
    const enDonjon = new Set(
      ZONES.flatMap((z) => z.pools?.boss ?? []).flatMap((c) =>
        COMBATS[c].ennemis.map((e) => e.monstre),
      ),
    );
    for (const [cle, s] of Object.entries(SUCCES).filter(([k]) => /^t[345]_/.test(k))) {
      for (const q of s.quetes) {
        if (q.critere.boss) {
          expect(enDonjon.has(q.critere.boss), `${cle} ${q.id}`).toBe(true);
        }
        if (q.critere.type === `relique_obtenue`) {
          expect(RELIQUES[q.critere.boss], q.id).toBeTruthy();
          expect(img(`/assets/reliques/${q.critere.boss}.png`), q.id).toBe(true);
        }
      }
    }
  });
});

describe(`défis Dofus 3 (Duo, Premier, Dernier)`, () => {
  const base = {
    gagne: true,
    vaincus: [`rat_blanc`, `chak_rat`],
    rondes: 3,
    herosKO: false,
    classes: [`iop`, `cra`, `feca`],
    degatsParElement: {},
    soins: 0,
    ascension: 0,
  };
  const faites = (resume) =>
    verifierQuetesCombat(nouvelEtatQuetes(), resume).quetes.map((q) => q.id);
  it(`Duo : 2 héros au plus au début du combat`, () => {
    expect(faites({ ...base, nbHeros: 3 })).not.toContain(`t3_duo_rat_blanc`);
    expect(faites({ ...base, nbHeros: 2 })).toContain(`t3_duo_rat_blanc`);
  });
  it(`Premier : le boss tombe avant ses alliés`, () => {
    expect(faites({ ...base, ordreVaincus: [`chak_rat`, `rat_blanc`] })).not.toContain(
      `t3_premier_rat_blanc`,
    );
    expect(faites({ ...base, ordreVaincus: [`rat_blanc`, `chak_rat`] })).toContain(
      `t3_premier_rat_blanc`,
    );
  });
  it(`la quête de donjon simple se valide dans tous les cas`, () => {
    expect(faites({ ...base, nbHeros: 4 })).toContain(`t3_donjon_rat_blanc`);
  });
});
