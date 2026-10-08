// Bonus de panoplie par palier : 2 pièces, 3 pièces, puis 4 pièces (+1 PA). Une panoplie de 2 ou
// 3 pièces complète donne aussi des résistances. Les valeurs (src/data/panoplies.json) suivent le
// niveau de la zone où tombe la panoplie.
import { EQUIPEMENTS, PANOPLIES } from "../data/index.js";

const NOMS_ELEMENTS_RES = { terre: `Terre`, feu: `Feu`, eau: `Eau`, air: `Air` };

/** Nombre de pièces de chaque panoplie portées par un héros. */
export function compterPanoplies(perso) {
  const t = {};
  for (const inst of Object.values(perso.equipement)) {
    const nom = inst && EQUIPEMENTS[inst.id]?.panoplie;
    if (nom) {
      t[nom] = (t[nom] ?? 0) + 1;
    }
  }
  return t;
}

export const taillePanoplie = (nom) =>
  new Set((PANOPLIES[nom]?.pieces ?? []).map((id) => EQUIPEMENTS[id]?.slot)).size;

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
