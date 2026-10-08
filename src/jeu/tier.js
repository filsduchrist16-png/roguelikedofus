// Tier d'un objet : sa puissance « théorique », la même pour tous les héros, pour comparer d'un coup
// d'œil deux objets de zones ou de raretés différentes. Chaque statistique est convertie en points
// selon ce qu'elle vaut en combat (vers le milieu du jeu) :
//   1 point d'élément (★ adaptatif) ≈ 1 Vitalité ; 1 % de résistance ≈ 3 ; 1 % de critique ≈ 1,8 ;
//   1 Soin ≈ 0,5 ; 1 PA ≈ 60 ; l'attaque d'une arme compte selon ses dégâts pour 4 PA.
// Le bonus de panoplie n'est pas compté (il dépend des autres pièces portées).
import { EQUIPEMENTS } from "../data/index.js";

const ELEMENTS_STATS = [`force`, `intelligence`, `agilite`, `chance`];

export function tierObjet(inst) {
  if (!inst) {
    return 0;
  }
  const s = inst.stats ?? {};
  const adapt = inst.adaptatif ?? 0;
  const elem = Math.max(0, ...ELEMENTS_STATS.map((k) => s[k] ?? 0));
  const res = Object.values(inst.resistances ?? {}).reduce((a, v) => a + v, 0) / 4;
  const attaque = inst.rarete ? EQUIPEMENTS[inst.id]?.tiers?.[inst.rarete]?.attaque : undefined;
  const arme = attaque ? (((attaque.baseMin + attaque.baseMax) / 2) * 4) / attaque.coutPA : 0;
  const pvBonus = EQUIPEMENTS[inst.id]?.pvBonus ?? 0;
  const t =
    adapt +
    elem +
    (s.vitalite ?? 0) +
    pvBonus +
    res * 100 * 3 +
    (s.crit ?? 0) * 1.8 +
    (s.soin ?? 0) * 0.5 +
    (inst.pa ?? 0) * 60 +
    arme;
  return Math.max(0, Math.round(t));
}

export const AIDE_TIER = `Tier : puissance théorique de l'objet (la même pour tous les héros). Plus il est haut, plus l'objet est fort. Les effets spéciaux et les bonus de panoplie n'y sont pas comptés.`;
