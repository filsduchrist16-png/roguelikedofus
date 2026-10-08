// Bonus de panoplie par palier, de 2 pièces à la panoplie complète (jusqu'à 7 pièces), comme dans
// Dofus : les pièces, le niveau et la forme des bonus (élément, vitalité, résistances, PA au palier
// où le vrai jeu en donne) viennent des vraies panoplies ; les valeurs (src/data/panoplies.json)
// suivent la zone où tombe la panoplie. Les PA de panoplie ne se cumulent pas (+1 au plus).
import { EQUIPEMENTS, PANOPLIES } from "../data/index.js";

const NOMS_ELEMENTS_RES = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

/** Nombre de pièces de chaque panoplie portées par un héros. */
export function compterPanoplies(perso) {
  const t = {};
  const vus = new Set();
  for (const inst of Object.values(perso.equipement)) {
    const nom = inst && EQUIPEMENTS[inst.id]?.panoplie;
    // une même pièce portée deux fois (deux anneaux identiques) ne compte qu'une fois
    if (nom && !vus.has(inst.id)) {
      vus.add(inst.id);
      t[nom] = (t[nom] ?? 0) + 1;
    }
  }
  return t;
}

export const taillePanoplie = (nom) => PANOPLIES[nom]?.pieces.length ?? 0;

export const paliersPanoplie = (nom) =>
  Object.keys(PANOPLIES[nom]?.paliers ?? {})
    .map(Number)
    .sort((a, b) => a - b);

/** Bonus actif pour `nb` pièces portées (le plus haut palier atteint), ou null. */
export function bonusPanoplie(nom, nb) {
  const p = PANOPLIES[nom];
  if (!p) {
    return null;
  }
  const palier = paliersPanoplie(nom)
    .filter((k) => k <= nb)
    .at(-1);
  return palier ? { palier, ...p.paliers[palier] } : null;
}

/** Texte court d'un palier : « +12 élément, +10 Vitalité, +1 PA ». */
export function texteBonusPanoplie(b) {
  if (!b) {
    return ``;
  }
  const out = [];
  if (b.pa) {
    out.push(`+${b.pa} PA`);
  }
  if (b.adaptatif) {
    out.push(`+${b.adaptatif} aux caracs d'élément`);
  }
  for (const [k, v] of Object.entries(b.stats ?? {})) {
    out.push(`+${v} ${k === `vitalite` ? `Vitalité` : k}`);
  }
  const res = Object.values(b.resistances ?? {});
  if (res.length) {
    const tous = res.length === 4 && res.every((v) => v === res[0]);
    out.push(
      tous
        ? `+${Math.round(res[0] * 100)} % de résistance partout`
        : Object.entries(b.resistances)
            .map(([e, v]) => `+${Math.round(v * 100)} % ${NOMS_ELEMENTS_RES[e]}`)
            .join(`, `),
    );
  }
  return out.join(`, `);
}

/** Description complète des paliers, pour les infobulles. */
export function descriptionPanoplie(nom) {
  return paliersPanoplie(nom)
    .map((k) => `${k} pièces : ${texteBonusPanoplie(PANOPLIES[nom].paliers[k])}`)
    .join(` · `);
}
