import { describe, expect, it } from "vitest";
import { resumeFinCombat } from "../src/ui/finCombat.js";
import { badgesCombattant, texteEffetsFurie } from "../src/ui/combat.js";
import { FURIE_BOSS } from "../src/jeu/config.js";

describe(`résumé de fin de combat`, () => {
  it(`compte rondes, ennemis vaincus et héros K.O., sans les invocations`, () => {
    const r = resumeFinCombat(
      [
        { camp: `joueur`, nom: `Iop`, pvActuels: 31.6, pvMax: 50 },
        { camp: `joueur`, nom: `Cra`, pvActuels: 0, pvMax: 40 },
        { camp: `joueur`, nom: `Tourelle`, pvActuels: 0, pvMax: 20, tourelle: true },
        { camp: `ennemi`, nom: `Bouftou`, pvActuels: 0, pvMax: 30 },
        { camp: `ennemi`, nom: `Tofu`, pvActuels: 12, pvMax: 20 },
        { camp: `ennemi`, nom: `Invoc`, pvActuels: 0, pvMax: 5, invoquePar: `x` },
      ],
      4,
    );
    expect(r).toEqual({
      rondes: 4,
      vaincus: 1,
      ennemis: 2,
      ko: 1,
      heros: [
        { nom: `Iop`, pv: 32, pvMax: 50, ko: false },
        { nom: `Cra`, pv: 0, pvMax: 40, ko: true },
      ],
    });
  });

  it(`reste vide sans combattants`, () => {
    expect(resumeFinCombat()).toMatchObject({ heros: [], vaincus: 0, ennemis: 0, ko: 0 });
  });
});

describe(`furie des boss`, () => {
  it(`résume ses effets pour le badge et l'infobulle`, () => {
    expect(texteEffetsFurie(FURIE_BOSS)).toEqual({
      court: `+20 % · +1 PA`,
      long: `+20 % de dégâts, +1 PA`,
    });
    expect(texteEffetsFurie({ ...FURIE_BOSS, bouclierPct: 0.15 }).long).toBe(
      `+20 % de dégâts, +1 PA, bouclier de 15 % des PV`,
    );
    expect(texteEffetsFurie(undefined)).toEqual({ court: ``, long: `` });
  });

  it(`le badge rappelle l'effet avant et pendant la furie`, () => {
    const boss = { pvActuels: 80, pvMax: 100, furie: { ...FURIE_BOSS }, effets: [] };
    const avant = badgesCombattant(boss).find((b) => b.texte.startsWith(`💢`));
    expect(avant.texte).toBe(`💢 Furie < 50 %`);
    expect(avant.tip).toContain(`+20 % de dégâts, +1 PA`);
    const pendant = badgesCombattant({ ...boss, enFurie: true }).find((b) =>
      b.texte.startsWith(`🔥`),
    );
    expect(pendant.texte).toBe(`🔥 Furie +20 % · +1 PA`);
    expect(pendant.tip).toContain(`+20 % de dégâts, +1 PA`);
  });
});
