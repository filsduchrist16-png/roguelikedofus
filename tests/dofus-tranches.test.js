import { describe, expect, it } from "vitest";
import { COMBATS, DOFUS, MONDES, SUCCES, ZONES } from "../src/data/index.js";
import { dofusDeSucces, nouvelEtatQuetes } from "../src/jeu/quetes.js";
import { mondeDuDofus } from "../src/jeu/obtention.js";
import {
  ajouterDofus,
  dofusAGagner,
  dofusDebloquables,
  rendreDofusSuspendus,
} from "../src/sauvegarde/meta.js";

const metaVide = () => ({ dofus: [], quetes: nouvelEtatQuetes(), archis: [], reliques: [] });
const succesDe = (id) => Object.values(SUCCES).find((s) => dofusDeSucces(s) === id);
const terminer = (meta, id) => meta.quetes.faites.push(...succesDe(id).quetes.map((q) => q.id));
// tranche de niveaux réelle de Dofus 3 → monde du jeu
const mondeDuNiveau = (n) =>
  n <= 50 ? `t1` : n <= 100 ? `t2` : n <= 150 ? `t3` : n < 200 ? `t4` : `t5`;
const ordre = MONDES.map((m) => m.id);
const mondeZone = Object.fromEntries(MONDES.flatMap((m) => m.zones.map((z) => [z, m.id])));
const mondesBoss = {};
for (const z of ZONES) {
  for (const l of Object.values(z.pools ?? {})) {
    for (const c of l) {
      for (const e of COMBATS[c].ennemis) {
        (mondesBoss[e.monstre] ??= new Set()).add(mondeZone[z.id]);
      }
    }
  }
}

describe(`Dofus et tranches de niveau`, () => {
  it(`chaque Dofus est rangé dans le monde de sa tranche de niveau`, () => {
    for (const d of Object.values(DOFUS)) {
      expect(mondeDuDofus(d.id)?.id, d.id).toBe(mondeDuNiveau(d.niveau));
    }
  });

  it(`ses quêtes se font au plus tard dans ce monde (jamais plus loin)`, () => {
    for (const d of Object.values(DOFUS)) {
      const max = ordre.indexOf(mondeDuNiveau(d.niveau));
      for (const q of succesDe(d.id).quetes) {
        const c = q.critere;
        const mondes = [
          ...(c.boss ? [...(mondesBoss[c.boss] ?? [])] : []),
          ...(c.zone ? [mondeZone[c.zone]] : []),
          ...(c.tranche ? [c.tranche] : []),
        ];
        // un boss présent dans plusieurs mondes : il suffit qu'un soit atteignable
        if (mondes.length) {
          expect(
            Math.min(...mondes.map((m) => ordre.indexOf(m))),
            `${d.id} : ${q.nom}`,
          ).toBeLessThanOrEqual(max);
        }
      }
    }
  });

  it(`un Dofus s'obtient dès que son succès est terminé, sans attendre les autres`, () => {
    const meta = metaVide();
    terminer(meta, `dofus_ebene`);
    expect(dofusAGagner(meta, succesDe(`dofus_ebene`))).toBe(`dofus_ebene`);
    expect(dofusDebloquables(meta)).toEqual([`dofus_ebene`]);
    ajouterDofus(meta, `dofus_ebene`, () => 0);
    expect(dofusDebloquables(meta)).toEqual([]);
  });

  it(`les Dofus mis de côté par l'ancien ordre strict reviennent avec leur jet`, () => {
    const meta = metaVide();
    meta.dofus = [{ id: `dofawa` }];
    meta.dofusSuspendus = [{ id: `dofus_kaliptus`, jet: 27 }, { id: `dofus_ebene` }];
    expect(rendreDofusSuspendus(meta).sort()).toEqual([`dofus_ebene`, `dofus_kaliptus`]);
    expect(meta.dofus.find((d) => d.id === `dofus_kaliptus`).jet).toBe(27);
    expect(meta.dofusSuspendus).toEqual([]);
    expect(rendreDofusSuspendus(meta)).toEqual([]);
  });
});
