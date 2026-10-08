import { describe, expect, it } from "vitest";
import { etatDefi } from "../src/jeu/defis.js";
import { etatObjectif } from "../src/jeu/objectifs.js";
import { nouveauSuiviCombat } from "../src/jeu/suiviCombat.js";

const ennemi = (ref, monstreId, pv = 10) => ({ ref, monstreId, camp: `ennemi`, pvActuels: pv });
const heros = (ref, pv = 10) => ({ ref, camp: `joueur`, pvActuels: pv });

describe(`défi et objectifs en direct`, () => {
  it(`Premier : réussi si la cible tombe en premier, raté sinon`, () => {
    const cs = [ennemi(`a`, `bouftou`), ennemi(`b`, `tofu`), heros(`h`)];
    const defi = { id: `premier`, cible: `a` };
    const s = nouveauSuiviCombat();
    expect(etatDefi(defi, s, cs).etat).toBe(`en_cours`);
    s.morts.add(`b`);
    expect(etatDefi(defi, s, cs).etat).toBe(`rate`);
    const s2 = nouveauSuiviCombat();
    s2.morts.add(`a`);
    expect(etatDefi(defi, s2, cs).etat).toBe(`assure`);
  });

  it(`Blitzkrieg et Survivant suivent les rondes et les KO`, () => {
    const cs = [ennemi(`a`, `bouftou`), heros(`h`)];
    const s = nouveauSuiviCombat();
    s.rondes = 2;
    expect(etatDefi({ id: `blitzkrieg`, rondesMax: 3 }, s, cs)).toEqual({
      etat: `en_cours`,
      detail: `ronde 2/3`,
    });
    s.rondes = 4;
    expect(etatDefi({ id: `blitzkrieg`, rondesMax: 3 }, s, cs).etat).toBe(`rate`);
    cs[1].pvActuels = 0;
    expect(etatDefi({ id: `survivant` }, s, cs).etat).toBe(`rate`);
  });

  it(`objectif « vaincre le boss » validé quand le boss tombe ; compteur qui avance`, () => {
    const cs = [ennemi(`a`, `bouftou_royal`), ennemi(`b`, `bouftou`), heros(`h`)];
    const s = nouveauSuiviCombat();
    const o = { suivi: { type: `vaincre`, boss: `bouftou_royal` } };
    expect(etatObjectif(o, s, cs).etat).toBe(`en_cours`);
    s.morts.add(`a`);
    expect(etatObjectif(o, s, cs).etat).toBe(`assure`);
    const c = { suivi: { type: `compteur`, evenement: `monstre_vaincu`, base: 23, seuil: 25 } };
    expect(etatObjectif(c, s, cs)).toEqual({ etat: `en_cours`, detail: `24/25` });
    s.morts.add(`b`);
    expect(etatObjectif(c, s, cs).etat).toBe(`assure`);
    const ko = { suivi: { type: `vaincre`, boss: `bouftou_royal`, sansKO: true } };
    cs[2].pvActuels = 0;
    expect(etatObjectif(ko, s, cs).etat).toBe(`rate`);
  });
});
